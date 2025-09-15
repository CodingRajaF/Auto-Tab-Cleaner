## 🧠 Coding Guidelines

### 🔧 General Naming Conventions (Functions, Variables, Attributes)

| Type | Naming Style | Example |
| --- | --- | --- |
| **Function** | snake\_case | `calculate_sum()` |
| **Variable** | snake\_case | `user_age`, `total_count` |
| **Attribute** | snake\_case | `self.user_name` |
| **Module** | snake\_case (lowercase) | `utils.py`, `data_loader.py` |
| **Package** | snake\_case (lowercase) | `my_package` |

-   **snake\_case** = words connected with lowercase letters and underscores
    

---

### 🧱 Classes and Constants

| Type | Naming Style | Example |
| --- | --- | --- |
| **Class** | PascalCase | `UserProfile`, `DataManager` |
| **Exception** | PascalCase + `Error` | `FileNotFoundError` |
| **Constant** | UPPER\_CASE | `MAX_CONNECTIONS` |

-   **PascalCase** = capitalize the first letter of each word and join them
    
-   **UPPER\_CASE** = all uppercase, words separated by underscores
    

---

### 👻 Special Naming Conventions (Conventions)

| Style | Meaning | Example |
| --- | --- | --- |
| `_single_leading_underscore` | Intended for internal use ("private") | `_internal_use_only` |
| `__double_leading_underscore` | Name mangling in classes | `__private_attr` |
| `__double_leading_and_trailing__` | Special built-in methods/attributes | `__init__`, `__str__` |

> 📝 Names like `__init__` are *magic methods*—don’t define your own arbitrarily!

---

## ✅ Points to Watch in Naming

-   Choose **short but meaningful names** (avoid vague names like `x`, `y`)
    
-   **Avoid abbreviations** (e.g., prefer `count` over `cnt`)
    
-   Use the **same rule (snake\_case)** for both variables and functions
    
-   Don’t use **reserved words or built-in function names** (e.g., `list`, `str`, `id`)
    

---

## 🔍 Reference Examples

| Purpose | Good Example | Bad Example |
| --- | --- | --- |
| User’s age | `user_age` | `ua`, `x` |
| Function to calculate sum | `calculate_total()` | `cal()`, `do()` |
| Data manager class | `DataManager` | `datamgr`, `dman` |
| Constant for max connections | `MAX_CONNECTIONS` | `maxconn`, `max_con` |

---

## ✅ Three Rules for Code Comments

1.  Write **why you did it**, not **what it does**  
    <br>❌ “Looping with a for statement” ← obvious from code  
    <br>✅ “Order matters, so using an array for management” ← gives context
    
2.  Assume the reader is a **new team member**
    
3.  When unsure, **write as if explaining to your past self**
