---
name: React version alignment
description: AURIX's Vite runtime failed when React and ReactDOM resolved to different patch versions.
---

Keep `react` and `react-dom` aligned at the same exact workspace catalog version, and have web artifacts consume those catalog entries rather than pinning one package independently.

**Why:** The browser hard-failed when the workspace resolved React 19.1.4 alongside ReactDOM 19.1.0. Typechecking did not detect the mismatch; only the runtime preview exposed it. Clerk's supported React peer versions also made using the workspace's older catalog pin unsuitable.

**How to apply:** Update both workspace catalog values together and use catalog references in each web artifact. Verify the browser preview after dependency resolution, not only with TypeScript.
