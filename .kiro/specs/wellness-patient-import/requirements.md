# Requirements: Two-Branch Patient Import (Separate Databases)

## Introduction

The Excel file `SHANTHI MEDICAL CENTER PATIENT DATA (2).xlsx` contains patients from
**two branches**:

| Branch Name (in Excel) | Database File | App Access |
|---|---|---|
| Shanthi Medical Center | `clinic-data.json` | Medical Center app/server |
| Shanthi wellness Ayurvedic medical center LLC | `wellness-data.json` | Wellness app/server |

Currently the existing import scripts only import **Shanthi Medical Center** patients into
`clinic-data.json`. The Wellness branch patients are silently discarded.

This feature creates:
1. **`import-wellness.js`** — imports only Wellness branch patients → `wellness-data.json`
2. A way for the server to load `wellness-data.json` instead of `clinic-data.json` when
   running in Wellness mode, so each branch sees only its own patient records.

---

## Glossary

| Term | Definition |
|------|-----------|
| **Medical Center branch** | Rows where BRANCH = "Shanthi Medical Center" |
| **Wellness branch** | Rows where BRANCH = "Shanthi wellness Ayurvedic medical center LLC" |
| **clinic-data.json** | Existing database for Medical Center patients |
| **wellness-data.json** | New database for Wellness patients |
| **Dry run** | Preview mode — parses and prints stats without writing files |
| **Duplicate** | A patient whose MR No already exists in the target database |

---

## Requirements

### Requirement 1: Wellness-Only Branch Filter

**User Story:** As a clinic admin, I want the Wellness import script to only process
"Shanthi wellness Ayurvedic medical center LLC" rows so that Medical Center patients are
never mixed into the Wellness database.

#### Acceptance Criteria

1. WHEN the script processes a row, THEN it SHALL check the BRANCH column (case-insensitive).
2. WHEN the BRANCH value contains "shanthi wellness ayurvedic medical center", THEN the row
   SHALL be included for import.
3. WHEN the BRANCH value does NOT match the Wellness name, THEN the row SHALL be skipped and
   counted as "other branch skipped."
4. WHEN the import finishes, THEN the summary SHALL show how many rows were skipped due to
   branch mismatch.

---

### Requirement 2: Separate Output Database — wellness-data.json

**User Story:** As a clinic admin, I want Wellness patients saved to `wellness-data.json`
so that they are completely separate from the Medical Center's `clinic-data.json`.

#### Acceptance Criteria

1. WHEN the import script completes successfully, THEN patient records SHALL be written to
   `wellness-data.json` in the same directory as `clinic-data.json`.
2. WHEN `wellness-data.json` does not yet exist, THEN the script SHALL create it with an
   empty patients array and sensible default `nextIds`.
3. WHEN `wellness-data.json` already exists, THEN the script SHALL load it and append new
   patients, preserving existing records.
4. WHEN writing is complete, THEN `clinic-data.json` SHALL remain completely unchanged.

---

### Requirement 3: Automatic Backup Before Writing

**User Story:** As a clinic admin, I want a timestamped backup created before any write so
that I can recover the previous state if needed.

#### Acceptance Criteria

1. WHEN the import runs in normal mode, THEN the script SHALL create
   `wellness-data.backup.<timestamp>.json` before modifying `wellness-data.json`.
2. WHEN running in dry-run mode (`--dry-run` flag), THEN no backup SHALL be created and no
   file SHALL be written.
3. WHEN the backup is created, THEN its filename SHALL be printed to the console.

---

### Requirement 4: Unique MR Number Handling

**User Story:** As a clinic admin, I want each Wellness patient to have a unique MR number
within the Wellness database, with no conflicts against Medical Center MR numbers.

#### Acceptance Criteria

1. WHEN the FILE column contains a valid non-zero integer, THEN that value SHALL be used as
   the patient's MR number.
2. WHEN the FILE column is blank, zero, or non-numeric, THEN the script SHALL auto-assign the
   next available MR number from `wellness-data.json`'s `nextIds.patient` counter.
3. WHEN an MR number already exists in `wellness-data.json`, THEN that row SHALL be skipped
   and counted as "duplicate skipped."
4. WHEN the import completes, THEN `db.nextIds.patient` in `wellness-data.json` SHALL be
   updated to one above the highest assigned MR number.

---

### Requirement 5: Patient Field Mapping

**User Story:** As a clinic admin, I want all patient fields correctly mapped from the Excel
columns so that imported records are complete and usable in the EMR.

#### Acceptance Criteria

1. WHEN mapping fields from the Excel row, THEN the following mapping SHALL be applied:

   | Excel Column | Patient Field | Rule |
   |---|---|---|
   | FILE | mrNo | parseInt; fallback to auto-assign |
   | FIRST NAME | firstName | clean(); fallback "(Unknown)" |
   | LAST NAME | lastName | clean() |
   | GENDER | gender | "Male" / "Female" / "" |
   | MOBILE | mobile | strip spaces, dashes, parentheses |
   | TELEPHONE | homeTel | strip spaces, dashes, parentheses |
   | DATE OF BIRTH | dob | DD/Mon/YYYY; skip 1900 sentinel dates |
   | EMAIL | email | discard "na", "nil@gmail.com", "@na.com" addresses |
   | EMIRATES ID | eid | discard scientific notation, "999-9999-9999999-9" |
   | PASSPORT | passport | clean() |
   | NATIONALITY | nationality | keep real nationalities; discard blank/invalid |
   | DATE CREATED | regDate | DD-MM-YYYY; fallback to today |

2. WHEN DATE OF BIRTH is an Excel serial number (numeric), THEN it SHALL be converted to
   DD/Mon/YYYY.
3. WHEN DATE OF BIRTH year is 1900 or earlier, THEN dob SHALL be stored as empty string.
4. WHEN EMIRATES ID contains `E+` or `e+` (scientific notation), THEN it SHALL be stored as
   empty string.
5. WHEN a row has no FIRST NAME and no LAST NAME, THEN it SHALL be skipped and counted as
   "invalid skipped."

---

### Requirement 6: Patient Record Defaults

**User Story:** As a clinic admin, I want imported Wellness patients to have correct default
field values so they work properly in the EMR.

#### Acceptance Criteria

1. WHEN building a patient record, THEN the following defaults SHALL be applied:

   | Field | Default Value |
   |---|---|
   | status | "Active" |
   | language | "English" |
   | category | "General" |
   | religion | "Not Specified" |
   | know | "Imported" |
   | packageName | "None" |
   | packageVisits | "0" |
   | packageBalance | "0" |
   | insuranceLimit | "0" |
   | insuranceCoPay | "0" |
   | noOfChildren | "0" |
   | vip | false |
   | pregnant | false |
   | medication | false |
   | importedFrom | "Excel Import - Shanthi Wellness LLC" |

---

### Requirement 7: Source Excel File Auto-Detection

**User Story:** As a clinic admin, I want the script to find the source file automatically
without needing to rename it.

#### Acceptance Criteria

1. WHEN the script runs, THEN it SHALL search for the source file in this priority order:
   - `SHANTHI MEDICAL CENTER PATIENT DATA (2).xlsx`
   - `SHANTHI MEDICAL CENTER PATIENT DATA.xlsx`
   - `patients-data.txt.xlsx`
   - `patients-data.xlsx`
   - `patients-data.txt`
   - `patients-data.csv`
2. WHEN no file is found, THEN the script SHALL print an error listing expected filenames and
   exit with a non-zero code.
3. WHEN a file is found, THEN its name SHALL be printed to the console before processing.

---

### Requirement 8: Clear Import Summary

**User Story:** As a clinic admin, I want a clear summary printed after each run so I know
exactly what happened.

#### Acceptance Criteria

1. WHEN the import finishes, THEN the console SHALL print:
   - Total rows read from file
   - Count of patients successfully imported
   - Count of rows skipped (duplicate MR)
   - Count of rows skipped (other branch)
   - Count of rows skipped (invalid/no name)
   - Total patient count now in `wellness-data.json`
2. WHEN running in dry-run mode, THEN the first 5 records that would be imported SHALL be
   shown as a preview.
3. WHEN zero patients are ready to import, THEN a warning SHALL be printed and the script
   SHALL exit without modifying any file.

---

### Requirement 9: Server Loads Correct Database Based on Branch Mode

**User Story:** As a clinic admin, I want the server to automatically load `wellness-data.json`
when running in Wellness mode, and `clinic-data.json` when running in Medical Center mode,
so each branch only sees its own patient records.

#### Acceptance Criteria

1. WHEN the server starts with `--wellness` flag (e.g. `node server.js --wellness`), THEN
   it SHALL load `wellness-data.json` as its database.
2. WHEN the server starts WITHOUT `--wellness` flag, THEN it SHALL load `clinic-data.json`
   as before (no change to current behaviour).
3. WHEN a request comes in to `/api/db-path`, THEN the response SHALL reflect the actual file
   being used.
4. WHEN the server is running in wellness mode, THEN all patient reads and writes SHALL use
   `wellness-data.json` exclusively.
5. WHEN the `package.json` scripts are updated, THEN there SHALL be a `start:wellness` script
   defined as `electron . --wellness` (or `node server.js --wellness` for non-Electron use).
