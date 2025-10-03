# Character
- Chat casually in Japanese  
- Insert line breaks for readability between messages  

# Shell
- Use PowerShell
- Use encoding utf-8

# 1. Flow Overview
The agent must follow the steps below when assisting with development.  
Each step requires explicit user review and approval before proceeding to the next.

1. **Requirements Definition Step**
   - Organize use cases, constraints, and priorities to create a requirements list.
   - Output: Requirements list (draft FR/NFR)

2. **Detailed Design Step**
   - Create a feature-level specification document (FS-xxx).
   - Output: `/docs/features/FS-{Index}-title.md`

3. **Mechanism Explanation Step**
   - Explain the processing flow, key components, and data structures based on the design.
   - Output: Explanatory notes attached to the design document (with emphasis on *Why*)

4. **Specification Update Step**
   - Reflect updates into the baseline specification `/docs/dev/spec.md`.
   - For feature additions: Add the FR/NFR defined in the FS to the FR section.
   - For new projects: Initiate FS-001 and create the first edition of the baseline specification.

5. **Implementation Step**
   - Generate code based on the specification and design.
   - Insert *Why*-focused comments in the code, following naming conventions and formatting rules.

6. **FS Index Assignment Rules**
   - The FS index must be automatically assigned by the AI.  
   - Method: Use the maximum existing index in `/docs/features/` + 1.  
   - If a duplicate index is detected, the AI must resolve it.  
   - Missing or skipped index numbers are not allowed (no gaps, no duplicates).

---

# 2. Branching: Feature Addition vs. New Creation

## Feature Addition
- In the Detailed Design Step, create a new FS-xxx file.  
  - Format: `/docs/features/FS-{Index}-title.md`  
  - Index must be assigned sequentially.  
- In the Specification Update Step, add the requirements defined in the FS to the FR section of `/docs/spec/00-spec.md`.

## New Creation
- The initial feature is also documented as FS-001.  
- In the Specification Update Step, create the baseline specification `/docs/spec/00-spec.md`.  

---

# 3. Approval Rules
- Each step’s deliverable must be reviewed and approved by the user.  
- The agent must not proceed to the next step until the user explicitly says “proceed.”  

---

# 4. Naming and Conventions
- FS files: `/docs/features/FS-{Index}-title.md`  
- Baseline specification: `/docs/spec/00-spec.md`  
- Comments: Focus on *Why* (one line, English-based, with Japanese notes if necessary)  
- Naming: Follow the conventions defined in the specification (e.g., camelCase for JS, snake_case for Python)

---

# 5. DoD (Definition of Done)
- All steps are completed: requirements → design → explanation → specification update → implementation.  
- FS-xxx and 00-spec.md remain consistent.  
- Code includes *Why* comments and complies with the specification.  

---

# Character Encoding
When generating code, always ensure Japanese characters are not garbled.  
Follow these rules:

1. Save files in UTF-8 (without BOM) by default.  
2. Always specify `encoding="utf-8"` or `"utf8"` when reading/writing files.  
3. For standard output/console, also specify UTF-8 (e.g., Python `sys.stdout.reconfigure`, Node.js `'utf8'`).  
4. For CSV files intended to be opened in Excel, use UTF-8 with BOM (`utf-8-sig`).  
5. For HTML, always include `<meta charset="UTF-8">` inside the `<head>`.  
6. In generated code, if necessary, add a comment briefly explaining *why* UTF-8 is required.  

---

# Coding Style
- Use **4 spaces** for indentation.

---

# Commenting

## General Guidelines
- Write comments focusing primarily on *Why* while also clarifying *What*.  
- Add concise notes in **Japanese** where helpful.  
