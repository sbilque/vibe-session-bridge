#!/usr/bin/env python3
"""Checks that every relative Markdown link points to an existing file."""
import re,os,glob
bad=[]
for f in glob.glob('**/*.md',recursive=True):
    if 'node_modules' in f: continue
    for l in re.findall(r'\]\(([^)#h][^)#]*)',re.sub(r'`[^`]*`', '', open(f).read())):
        if not os.path.exists(os.path.normpath(os.path.join(os.path.dirname(f),l))): bad.append((f,l))
print("\n".join(f"{f}: {l}" for f, l in bad) or "OK: all relative links resolve")
raise SystemExit(1 if bad else 0)
