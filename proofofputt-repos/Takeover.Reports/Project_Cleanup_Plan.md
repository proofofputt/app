# Project Cleanup and Reorganization Plan: Proof of Putt

## Objective
This comprehensive plan outlines the steps to clean up, reorganize, and streamline the "Proof of Putt" project. The primary goals are to:
1.  **Preserve all existing progress** on both the desktop and web applications.
2.  **Eliminate all sources of hardcoded mock data** and ensure dynamic data from NeonDB is used.
3.  **Establish a clear and maintainable project structure**, separating web and desktop components.
4.  **Clean up the Git history** to remove duplications and unnecessary commits (with careful user oversight).
5.  **Prepare the project for long-term development and deployment.**

---

## Phase 1: Preparation and Comprehensive Backup (CRITICAL SAFETY STEP)

**Goal:** Ensure no data loss occurs during the reorganization process.

**Steps:**

1.  **Full Repository Backup:**
    *   **Action:** Create a complete, compressed archive of your entire `/Users/nw/proofofputt-repos/` directory.
    *   **Command:** `tar -czvf proofofputt_repos_backup_$(date +%Y%m%d_%H%M%S).tar.gz /Users/nw/proofofputt-repos/`
    *   **Verification:** Confirm the `.tar.gz` file is created and can be uncompressed. Store this backup in a safe, external location.

2.  **Verify Current Git Status:**
    *   **Action:** Ensure your current working directory is clean and all desired local changes are committed.
    *   **Command:** `git status` (from `/Users/nw/proofofputt-repos/`)
    *   **Expected Output:** "nothing to commit, working tree clean" (for both parent and submodules). If not, commit or stash any remaining changes.

3.  **Document Current Directory Structure:**
    *   **Action:** Generate a detailed tree of the current project structure for reference.
    *   **Command:** `tree -L 3 /Users/nw/proofofputt-repos/ > current_structure.txt` (Install `tree` if not available: `brew install tree` on macOS, `sudo apt-get install tree` on Debian/Ubuntu).
    *   **Verification:** Review `current_structure.txt` to ensure it accurately reflects the current layout.

---

## Phase 2: Data Cleanup and API Consolidation

**Goal:** Eliminate all remaining mock data and consolidate the web API.

**Steps:**

1.  **Final Verification of Mock Data Sources:**
    *   **Action:** Re-confirm that `app/api/leaderboards.js` and `app/api/sessions.js` have been updated to query the database and no longer contain hardcoded mock data.
    *   **Verification:** Manually inspect these files.
    *   **Action:** Ensure `proofofputt/api/[...path].js` (the old mock catch-all) has been deleted.
    *   **Verification:** `ls /Users/nw/proofofputt-repos/proofofputt/api/[...path].js` should return "No such file or directory".

2.  **Ensure Database is Clean:**
    *   **Action:** Run the `reset_database.sql` script one final time to ensure a pristine database state.
    *   **Script Location:** `/Users/nw/proofofputt-repos/reset_database.sql`
    *   **Instructions:** Follow the previous instructions for running SQL scripts in the NeonDB console.
    *   **Verification:** In NeonDB console, run `SELECT * FROM players;`, `SELECT * FROM sessions;`, `SELECT * FROM player_stats;`. Only the default `pop@proofofputt.com` user should exist, with zeroed stats and no sessions.

3.  **Consolidate Web API (Node.js):**
    *   **Action:** Confirm that `app/api/` is the designated Node.js API directory.
    *   **Verification:** Review `app/vercel.json` to ensure `functions` points to `api/**/*.js`.

4.  **Remove Redundant/Old API Directories:**
    *   **Action:** Delete the old Python/Flask API directory.
    *   **Command:** `rm -rf /Users/nw/proofofputt-repos/app/apps/api/`
    *   **Verification:** `ls /Users/nw/proofofputt-repos/app/apps/api/` should return "No such file or directory".
    *   **Action:** Delete the `proofofputt/` directory (as it contains old API code and is likely unused).
    *   **Command:** `rm -rf /Users/nw/proofofputt-repos/proofofputt/`
    *   **Verification:** `ls /Users/nw/proofofputt-repos/proofofputt/` should return "No such file or directory".

---

## Phase 3: Project Reorganization (New Monorepo Structure)

**Goal:** Establish a clean, logical, and separated monorepo structure.

**Proposed New Structure:**

```
/proofofputt-monorepo/ (New Parent Git Repository)
├── apps/
│   ├── web/        (Contains the React/Vite frontend and its Node.js API)
│   │   ├── api/    (Node.js API endpoints)
│   │   └── src/    (React/Vite frontend code)
│   └── desktop/    (Contains the Tauri desktop application)
│       ├── src/    (React/Vite frontend for desktop)
│       ├── src-tauri/ (Rust backend for Tauri)
│       └── python/ (Python CV scripts)
└── packages/
    └── common/     (For shared code, e.g., utility functions, types - Future consideration)
```

**Steps:**

1.  **Create New Parent Directory and Git Repository:**
    *   **Action:** Create a new, empty directory for the monorepo and initialize a new Git repository within it.
    *   **Command:**
        ```bash
        mkdir /Users/nw/proofofputt-monorepo
        cd /Users/nw/proofofputt-monorepo
        git init
        ```
    *   **Verification:** `ls -la` should show `.git` directory.

2.  **Move Web Application Files:**
    *   **Action:** Move the contents of the current `app/` submodule (excluding its `.git` directory) into `proofofputt-monorepo/apps/web/`.
    *   **Command:**
        ```bash
        mkdir -p /Users/nw/proofofputt-monorepo/apps/web
        rsync -av --exclude='.git' /Users/nw/proofofputt-repos/app/ /Users/nw/proofofputt-monorepo/apps/web/
        ```
    *   **Verification:** Check contents of `/Users/nw/proofofputt-monorepo/apps/web/`.

3.  **Move Desktop Application Files:**
    *   **Action:** Move the contents of the current `desktop/` submodule (excluding its `.git` directory) into `proofofputt-monorepo/apps/desktop/`.
    *   **Command:**
        ```bash
        mkdir -p /Users/nw/proofofputt-monorepo/apps/desktop
        rsync -av --exclude='.git' /Users/nw/proofofputt-repos/desktop/ /Users/nw/proofofputt-monorepo/apps/desktop/
        ```
    *   **Verification:** Check contents of `/Users/nw/proofofputt-monorepo/apps/desktop/`.

4.  **Update Internal Paths and References:**
    *   **Action:** This is a manual step. You will need to go through the moved files and update any hardcoded paths or relative imports that refer to the old structure.
    *   **Key Files to Check:**
        *   `apps/web/vercel.json`: Update `outputDirectory` if needed.
        *   `apps/web/api/**/*.js`: Check imports like `../db.js`.
        *   `apps/desktop/src/App.jsx`: Check `apiUrl` and `playerId` references.
        *   `apps/desktop/src-tauri/src/main.rs`: Update `script_path` for Python scripts.
        *   `apps/desktop/python/**/*.py`: Check any relative paths for data files or other scripts.
    *   **Verification:** Attempt to build and run both `apps/web` and `apps/desktop` in their new locations.

---

## Phase 4: Git Repository Cleanup and Setup

**Goal:** Create a clean Git history and set up new remote repositories.

**Steps:**

1.  **Initial Commit in New Monorepo:**
    *   **Action:** Commit all the moved files into the new monorepo.
    *   **Command:**
        ```bash
        cd /Users/nw/proofofputt-monorepo
        git add .
        git commit -m "feat: Initial monorepo setup with web and desktop applications"
        ```
    *   **Verification:** `git log --oneline` should show your new commit.

2.  **Create New Remote GitHub Repository:**
    *   **Action:** Go to GitHub (or your preferred Git hosting service) and create a **new, empty repository** (e.g., `proofofputt-monorepo`). **Do NOT initialize with a README or license.**
    *   **Verification:** The new repository is created and empty.

3.  **Link Local Monorepo to New Remote:**
    *   **Action:** Add the new GitHub repository as the remote for your local monorepo.
    *   **Command:** `git remote add origin <URL_of_your_new_github_repo>` (e.g., `git remote add origin https://github.com/your-username/proofofputt-monorepo.git`)
    *   **Verification:** `git remote -v` should show the new remote.

4.  **Push Initial Monorepo Code:**
    *   **Action:** Push your local monorepo code to the new remote.
    *   **Command:** `git push -u origin main`
    *   **Verification:** Check your new GitHub repository to ensure all files are pushed.

5.  **Clean Git History (Optional but Recommended - USE WITH EXTREME CAUTION):**
    *   **Warning:** This step rewrites Git history. **Only perform this if you are comfortable with Git rebase and understand its implications.** It is best done on a fresh clone or after a very robust backup. If unsure, skip this and proceed with the existing history.
    *   **Action:** Use `git rebase -i` or `git filter-repo` (more powerful) to squash commits, remove large files, or eliminate sensitive data.
    *   **Recommendation:** For a truly clean start, consider creating a *new* repository and migrating only the final, clean state of the code. This avoids complex history rewriting.

---

## Phase 5: Verification and Finalization

**Goal:** Ensure both applications are fully functional in the new structure and ready for deployment.

**Steps:**

1.  **End-to-End Testing:**
    *   **Action:**
        *   Navigate to `/Users/nw/proofofputt-monorepo/apps/web` and install dependencies (`npm install`).
        *   Run the web app (`npm run dev`).
        *   Navigate to `/Users/nw/proofofputt-monorepo/apps/desktop` and install dependencies (`npm install`).
        *   Run the desktop app (`npm run tauri dev`).
        *   Perform calibration, sync data, and verify that the web app displays the correct, non-mock data.
    *   **Verification:** Both applications run without errors, and data flows correctly.

2.  **Update Deployment Pipelines:**
    *   **Action:** Update your Vercel project settings to point to the new `apps/web` directory as the root for the web deployment.
    *   **Verification:** A successful Vercel deployment.

3.  **Documentation Update:**
    *   **Action:** Update `README.md` files in the new `proofofputt-monorepo` root, `apps/web`, and `apps/desktop` to reflect the new structure and setup instructions.

4.  **Final Review and Handover:**
    *   **Action:** Review the entire project with the new structure. Delete old backup directories (`proofofputt-repos` itself, `proofofputt-backup`, `proofofputt.prototype`) once you are absolutely confident in the new setup.

---

This plan is designed to be thorough and safe. Please proceed carefully, especially with backup and Git history steps. Let me know when you are ready to begin Phase 1.
