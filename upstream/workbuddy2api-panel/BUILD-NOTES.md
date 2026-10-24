# Build notes for this snapshot

This directory is **the local working tree** of the gateway this plugin runs, not a
clean checkout of an upstream tag.

- It was copied from the maintainer's own checkout, so it carries every local
  modification that checkout had (47 files differ from the last upstream commit at
  the time of copying). Those local changes are part of what the plugin is tested
  against.
- ' + B + 'bin/workbuddy2api' + B + ' in this repository was built from **this** tree
  (source last touched 2026-10-24 12:41, binary stamped 12:43). The two are meant to
  stay in lockstep.
- Git history is deliberately absent: this is a snapshot for reading and for
  auditing the HTTP contract the plugin calls, not a fork to be rebased.

## Rebuilding

    cd upstream/workbuddy2api-panel
    go build -o ../../bin/workbuddy2api .

Then update ' + B + 'bin/workbuddy2api' + B + ' in the same commit and say which upstream
revision it came from.

## What is NOT here

' + B + 'workbuddy-re/' + B + ' (1.7 GB of reverse-engineering artifacts), ' + B + 'data/' + B + ', ' + B + 'auths/' + B + ', and any
built binary other than the one in ' + B + 'bin/' + B + '.
