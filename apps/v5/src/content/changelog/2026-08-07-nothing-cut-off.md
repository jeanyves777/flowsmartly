---
date: 2026-08-07
kind: Fixed
title: Nothing on the page is cut off any more
---

Text was clipping at some viewport widths across 44 routes, including at wider
sizes than ones where the same text fitted.

The detector that had reported them all clean was keyed to the wrong CSS
property; it now catches what it had been missing.
