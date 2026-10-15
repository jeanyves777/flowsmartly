# Pinned V5 apex config fixture

`nginx-apex-v5.conf` is an exact byte-for-byte snapshot of
`jeanyves777/flowsmartly-v5:deploy/nginx-apex-v5.conf` fetched from the
`main` ref for the V5 public-entry CI check.

Upstream Git blob SHA-1: `6896ea6336e692be3743396a3d21b33e4b4e51ed`.

The test suite verifies this Git blob SHA before exercising the verifier against
the snapshot. CI uses this reviewed, pinned snapshot because the PR workflow
token cannot read the separate private V5 repository. This preserves route
validation without broadening token access or adding a secret. When the V5
authoritative config changes, refresh this snapshot and its pinned source blob
SHA together in a reviewed PR; the live operator must still verify the active
host config separately.
