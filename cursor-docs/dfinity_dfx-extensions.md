/.github/workflows/build-extension-manually.sh:
-----------------------

#!/usr/bin/env bash

set -e -o pipefail

build_manually() (
  local extension_name="$1"
  package_version=$(cargo metadata --format-version=1 | jq -r '.workspace_members[]' | grep "$extension_name" | cut -d" " -f2)
  echo "package version for $extension_name: $package_version"
  cargo dist build --tag="$extension_name-v$package_version" # cargo-dist needs git tag only metadata-related stuff; it won't do git checkout, it will build from HEAD
  extension_dir="$PREBUILT_EXTENSIONS_DIR/$extension_name"
  arch_platform="$(get_arch_and_platform)"
  mkdir -p "${extension_dir}"
  tar xzf "target/distrib/$extension_name-$arch_platform.tar.gz" --strip-components 1 -C "$extension_dir"
)

get_arch_and_platform() {
  ARCH=$(uname -m)
  SYS=$(uname -s)

  if [[ "$ARCH" == "x86_64" ]]; then
    if [[ "$SYS" == "Darwin" ]]; then
      echo "$ARCH-apple-darwin"
    elif [[ "$SYS" == "Linux" ]]; then
      echo "$ARCH-unknown-linux-gnu"
    else
      echo "System not recognized"
    fi
  elif [[ "$ARCH" == "arm64" && "$SYS" == "Darwin" ]]; then
    echo "aarch64-apple-darwin"
  else
    echo "Architecture not recognized"
  fi
}

build_manually "$1"


-----------------------

/.github/workflows/e2e.yml:
-----------------------

name: Run e2e tests

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

on:
  push:
    branches:
      - main
  pull_request:

jobs:
  test-extension:
    runs-on: ${{ matrix.os }}
    strategy:
      fail-fast: false
      matrix:
        os: [ macos-12, ubuntu-20.04 ]
        extension: [ nns, sns ]
    steps:
      - uses: actions/checkout@v4
        with:
          submodules: 'recursive'
      - uses: actions/cache@v4
        with:
          path: |
            ~/.cargo/bin/
            ~/.cargo/registry/index/
            ~/.cargo/registry/cache/
            ~/.cargo/git/db/
            target/
          key: ${{ runner.os }}-cargo-e2e-${{ matrix.extension }}-${{ hashFiles('**/Cargo.lock') }}
          restore-keys: |
            ${{ runner.os }}-cargo-e2e-${{ matrix.extension }}-
            ${{ runner.os }}-cargo-e2e-
      - name: Install brew
        uses: Homebrew/actions/setup-homebrew@master
        if: contains(matrix.os, 'macos-12') == false
      - name: Install sponge and timeout 
        run: brew install coreutils sponge
      - name: Install cargo-dist
        run: curl --proto '=https' --tlsv1.2 -LsSf https://axodotdev.artifacts.axodotdev.host/cargo-dist/v0.10.0/cargo-dist-installer.sh | sh
      - name: Install IC SDK (dfx)
        uses: dfinity/setup-dfx@main
        with:
          dfx-version: "0.23.0"
      - name: Set prebuilt extensions directory
        run: echo "PREBUILT_EXTENSIONS_DIR=$HOME/prebuilt-extensions" >> $GITHUB_ENV
      - name: Build extension manually
        run: .github/workflows/build-extension-manually.sh ${{ matrix.extension }}
      - name: Build nns manually
        run: .github/workflows/build-extension-manually.sh nns
        if: matrix.extension == 'sns'
      - name: run test
        run: timeout 2400 e2e/bats/bin/bats extensions/${{ matrix.extension }}/e2e/tests/*.bash

  aggregate:
    name: e2e:required
    if: ${{ always() }}
    needs: [test-extension]
    runs-on: ubuntu-latest
    steps:
      - name: check e2e test result
        if: ${{ needs.test-extension.result != 'success' }}
        run: exit 1


-----------------------

/.github/workflows/prepare-release.yml:
-----------------------

name: Release with GitHub Action

permissions:
  contents: write
  pull-requests: write

on:
  workflow_dispatch:
    inputs:
      whichCrate:
        description: 'Which crate you wish to release?'
        required: true
        type: choice
        options:
        - nns
        - sns
      semverBump:
        description: 'Specify SemVer version you wish to bump (see: https://github.com/crate-ci/cargo-release/blob/master/docs/reference.md#bump-level)'
        required: true
        type: choice
        options:
        - custom
        - release
        - patch
        - minor
        - major
        - alpha
        - beta
        - rc
      semverVersion:
        description: 'Specify exact SemVer version (corresponds to [version] listed here: https://github.com/crate-ci/cargo-release/blob/master/docs/reference.md#bump-level). Works only when you have selected [custom] in previous dropdox.'
        default: ''
        required: false
        type: string

jobs:
  create-release:
    runs-on: ubuntu-latest
    steps:
      - name: check parameters
        if: ${{ inputs.semverBump == 'custom' && inputs.semverVersion == '' }}
        run: |
            echo "You have selected [custom] in the previous dropdown, but you have not provided the exact version. Please provide the exact version."
            exit 1

      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: cargo-bins/cargo-binstall@main
      - run: cargo binstall cargo-release -y
      - name: Install sponge
        run: sudo apt-get install --yes moreutils

      - name: Unify semver choice
        env:
          SEMVER_CHOICE: ${{ inputs.semverBump == 'custom' && inputs.semverVersion || inputs.semverBump }}
        run: |
          echo "SEMVER_CHOICE is $SEMVER_CHOICE"
          echo "SEMVER_CHOICE=$SEMVER_CHOICE" >> "$GITHUB_ENV"

      - name: Determine new version number by dry-running `cargo-release`
        run: |
          echo "SEMVER_CHOICE is $SEMVER_CHOICE"
          NEW_VERSION="$(
            cargo release version -p ${{ inputs.whichCrate}} ${{ env.SEMVER_CHOICE }} 2>&1 \
              | grep "Upgrading .* from .* to .*" \
              | awk '{print $6}' \
          )"

          echo "New version is $NEW_VERSION"
          echo "NEW_VERSION=$NEW_VERSION" >> "$GITHUB_ENV"

      - name: Switch to the release branch
        run: |
          BRANCH_NAME="release/${{ inputs.whichCrate }}-v${{ env.NEW_VERSION }}"
          git switch -c "$BRANCH_NAME"


      - name: Set up git config
        run: |
          git config author.email "${{ github.event.sender.id }}+${{ github.event.sender.login }}@users.noreply.github.com"
          git config author.name "${{ github.event.sender.login }}"
          git config committer.email "41898282+github-actions[bot]@users.noreply.github.com"
          git config committer.name "GitHub Actions Bot"
          git config user.email "${{ github.event.sender.id }}+${{ github.event.sender.login }}@users.noreply.github.com"
          git config user.name "${{ github.event.sender.login }}"

      - name: Update dependencies.json, roll changelog, bump version, and push branch
        run: |
          .github/workflows/update-dependencies.sh ${{ inputs.whichCrate }} "${{ env.NEW_VERSION }}"
          git commit -am "chore: transfer dependencies for ${{ inputs.whichCrate }} version ${{ env.NEW_VERSION }}"
          # see https://opensource.axo.dev/cargo-dist/book/workspaces/cargo-release-guide.html#using-cargo-release-with-pull-requests
          cargo release -p ${{ inputs.whichCrate }} "${{ env.SEMVER_CHOICE }}" --execute --no-confirm --config extensions/${{ inputs.whichCrate }}/prepare-release.toml

      - name: Open the release PR
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          TAG="${{ inputs.whichCrate }}-v${{ env.NEW_VERSION }}"
          HEAD="release/$TAG"
          TITLE="chore(${{ inputs.whichCrate }}): release v${{ env.NEW_VERSION }}"
          cat >BODY.md <<EOF
          PR created by this workflow: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}
          Link to release: https://github.com/${{ github.server_url }}/${{ github.repository }}/releases/tag/$TAG
          After merging, run the following:

          \`\`\`bash
          git checkout main
          git pull
          cargo dist plan
          cargo release -p ${{ inputs.whichCrate }} --execute
          \`\`\`
          EOF
          echo 'The message "Warning: 1 uncommitted change" refers to BODY.md'
          gh pr create --base main --head "$HEAD" --title "$TITLE" --body-file BODY.md


-----------------------

/.github/workflows/release.yml:
-----------------------

# Copyright 2022-2023, axodotdev
# SPDX-License-Identifier: MIT or Apache-2.0
#
# CI that:
#
# * checks for a Git Tag that looks like a release
# * builds artifacts with cargo-dist (archives, installers, hashes)
# * uploads those artifacts to temporary workflow zip
# * on success, uploads the artifacts to a Github Release
#
# Note that the Github Release will be created with a generated
# title/body based on your changelogs.

name: Release

permissions:
  contents: write

# This task will run whenever you push a git tag that looks like a version
# like "1.0.0", "v0.1.0-prerelease.1", "my-app/0.1.0", "releases/v1.0.0", etc.
# Various formats will be parsed into a VERSION and an optional PACKAGE_NAME, where
# PACKAGE_NAME must be the name of a Cargo package in your workspace, and VERSION
# must be a Cargo-style SemVer Version (must have at least major.minor.patch).
#
# If PACKAGE_NAME is specified, then the announcement will be for that
# package (erroring out if it doesn't have the given version or isn't cargo-dist-able).
#
# If PACKAGE_NAME isn't specified, then the announcement will be for all
# (cargo-dist-able) packages in the workspace with that version (this mode is
# intended for workspaces with only one dist-able package, or with all dist-able
# packages versioned/released in lockstep).
#
# If you push multiple tags at once, separate instances of this workflow will
# spin up, creating an independent announcement for each one. However Github
# will hard limit this to 3 tags per commit, as it will assume more tags is a
# mistake.
#
# If there's a prerelease-style suffix to the version, then the release(s)
# will be marked as a prerelease.
on:
  push:
    tags:
      - '**[0-9]+.[0-9]+.[0-9]+*'

jobs:
  # Run 'cargo dist plan' (or host) to determine what tasks we need to do
  plan:
    runs-on: ubuntu-latest
    outputs:
      val: ${{ steps.plan.outputs.manifest }}
      tag: ${{ !github.event.pull_request && github.ref_name || '' }}
      tag-flag: ${{ !github.event.pull_request && format('--tag={0}', github.ref_name) || '' }}
      publishing: ${{ !github.event.pull_request }}
    env:
      GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    steps:
      - uses: actions/checkout@v4
        with:
          submodules: recursive
      - name: Install cargo-dist
        # we specify bash to get pipefail; it guards against the `curl` command
        # failing. otherwise `sh` won't catch that `curl` returned non-0
        shell: bash
        run: "curl --proto '=https' --tlsv1.2 -LsSf https://github.com/axodotdev/cargo-dist/releases/download/v0.10.0/cargo-dist-installer.sh | sh"
      # sure would be cool if github gave us proper conditionals...
      # so here's a doubly-nested ternary-via-truthiness to try to provide the best possible
      # functionality based on whether this is a pull_request, and whether it's from a fork.
      # (PRs run on the *source* but secrets are usually on the *target* -- that's *good*
      # but also really annoying to build CI around when it needs secrets to work right.)
      - id: plan
        run: |
          cargo dist ${{ (!github.event.pull_request && format('host --steps=create --tag={0}', github.ref_name)) || 'plan' }} --output-format=json > plan-dist-manifest.json
          echo "cargo dist ran successfully"
          cat plan-dist-manifest.json
          echo "manifest=$(jq -c "." plan-dist-manifest.json)" >> "$GITHUB_OUTPUT"
      - name: "Upload dist-manifest.json"
        uses: actions/upload-artifact@v4
        with:
          name: artifacts-plan-dist-manifest
          path: plan-dist-manifest.json

  # Build and packages all the platform-specific things
  build-local-artifacts:
    name: build-local-artifacts (${{ join(matrix.targets, ', ') }})
    # Let the initial task tell us to not run (currently very blunt)
    needs:
      - plan
    if: ${{ fromJson(needs.plan.outputs.val).ci.github.artifacts_matrix.include != null && (needs.plan.outputs.publishing == 'true' || fromJson(needs.plan.outputs.val).ci.github.pr_run_mode == 'upload') }}
    strategy:
      fail-fast: false
      # Target platforms/runners are computed by cargo-dist in create-release.
      # Each member of the matrix has the following arguments:
      #
      # - runner: the github runner
      # - dist-args: cli flags to pass to cargo dist
      # - install-dist: expression to run to install cargo-dist on the runner
      #
      # Typically there will be:
      # - 1 "global" task that builds universal installers
      # - N "local" tasks that build each platform's binaries and platform-specific installers
      matrix: ${{ fromJson(needs.plan.outputs.val).ci.github.artifacts_matrix }}
    runs-on: ${{ matrix.runner }}
    env:
      GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      BUILD_MANIFEST_NAME: target/distrib/${{ join(matrix.targets, '-') }}-dist-manifest.json
    steps:
      - uses: actions/checkout@v4
        with:
          submodules: recursive
      - uses: swatinem/rust-cache@v2
      - name: Install cargo-dist
        run: ${{ matrix.install_dist }}
      # Get the dist-manifest
      - name: Fetch local artifacts
        uses: actions/download-artifact@v4
        with:
          pattern: artifacts-*
          path: target/distrib/
          merge-multiple: true
      - name: Install dependencies
        run: |
          ${{ matrix.packages_install }}
      - name: Build artifacts
        run: |
          # Actually do builds and make zips and whatnot
          cargo dist build ${{ needs.plan.outputs.tag-flag }} --print=linkage --output-format=json ${{ matrix.dist_args }} > dist-manifest.json
          echo "cargo dist ran successfully"
      - id: cargo-dist
        name: Post-build
        # We force bash here just because github makes it really hard to get values up
        # to "real" actions without writing to env-vars, and writing to env-vars has
        # inconsistent syntax between shell and powershell.
        shell: bash
        run: |
          # Parse out what we just built and upload it to scratch storage
          echo "paths<<EOF" >> "$GITHUB_OUTPUT"
          jq --raw-output ".artifacts[]?.path | select( . != null )" dist-manifest.json >> "$GITHUB_OUTPUT"
          echo "EOF" >> "$GITHUB_OUTPUT"

          cp dist-manifest.json "$BUILD_MANIFEST_NAME"
      - name: "Upload artifacts"
        uses: actions/upload-artifact@v4
        with:
          name: artifacts-build-local-${{ join(matrix.targets, '_') }}
          path: |
            ${{ steps.cargo-dist.outputs.paths }}
            ${{ env.BUILD_MANIFEST_NAME }}

  # Build and package all the platform-agnostic(ish) things
  build-global-artifacts:
    needs:
      - plan
      - build-local-artifacts
    runs-on: "ubuntu-20.04"
    env:
      GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      BUILD_MANIFEST_NAME: target/distrib/global-dist-manifest.json
    steps:
      - uses: actions/checkout@v4
        with:
          submodules: recursive
      - name: Install cargo-dist
        run: "curl --proto '=https' --tlsv1.2 -LsSf https://github.com/axodotdev/cargo-dist/releases/download/v0.10.0/cargo-dist-installer.sh | sh"
      # Get all the local artifacts for the global tasks to use (for e.g. checksums)
      - name: Fetch local artifacts
        uses: actions/download-artifact@v4
        with:
          pattern: artifacts-*
          path: target/distrib/
          merge-multiple: true
      - id: cargo-dist
        shell: bash
        run: |
          cargo dist build ${{ needs.plan.outputs.tag-flag }} --output-format=json "--artifacts=global" > dist-manifest.json
          echo "cargo dist ran successfully"

          # Parse out what we just built and upload it to scratch storage
          echo "paths<<EOF" >> "$GITHUB_OUTPUT"
          jq --raw-output ".artifacts[]?.path | select( . != null )" dist-manifest.json >> "$GITHUB_OUTPUT"
          echo "EOF" >> "$GITHUB_OUTPUT"

          cp dist-manifest.json "$BUILD_MANIFEST_NAME"
      - name: "Upload artifacts"
        uses: actions/upload-artifact@v4
        with:
          name: artifacts-build-global
          path: |
            ${{ steps.cargo-dist.outputs.paths }}
            ${{ env.BUILD_MANIFEST_NAME }}
  # Determines if we should publish/announce
  host:
    needs:
      - plan
      - build-local-artifacts
      - build-global-artifacts
    # Only run if we're "publishing", and only if local and global didn't fail (skipped is fine)
    if: ${{ always() && needs.plan.outputs.publishing == 'true' && (needs.build-global-artifacts.result == 'skipped' || needs.build-global-artifacts.result == 'success') && (needs.build-local-artifacts.result == 'skipped' || needs.build-local-artifacts.result == 'success') }}
    env:
      GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    runs-on: "ubuntu-20.04"
    outputs:
      val: ${{ steps.host.outputs.manifest }}
    steps:
      - uses: actions/checkout@v4
        with:
          submodules: recursive
      - name: Install cargo-dist
        run: "curl --proto '=https' --tlsv1.2 -LsSf https://github.com/axodotdev/cargo-dist/releases/download/v0.10.0/cargo-dist-installer.sh | sh"
      # Fetch artifacts from scratch-storage
      - name: Fetch artifacts
        uses: actions/download-artifact@v4
        with:
          pattern: artifacts-*
          path: target/distrib/
          merge-multiple: true
      # This is a harmless no-op for Github Releases, hosting for that happens in "announce"
      - id: host
        shell: bash
        run: |
          cargo dist host ${{ needs.plan.outputs.tag-flag }} --steps=upload --steps=release --output-format=json > dist-manifest.json
          echo "artifacts uploaded and released successfully"
          cat dist-manifest.json
          echo "manifest=$(jq -c "." dist-manifest.json)" >> "$GITHUB_OUTPUT"
      - name: "Upload dist-manifest.json"
        uses: actions/upload-artifact@v4
        with:
          # Overwrite the previous copy
          name: artifacts-dist-manifest
          path: dist-manifest.json

  # Create a Github Release while uploading all files to it
  announce:
    needs:
      - plan
      - host
    # use "always() && ..." to allow us to wait for all publish jobs while
    # still allowing individual publish jobs to skip themselves (for prereleases).
    # "host" however must run to completion, no skipping allowed!
    if: ${{ always() && needs.host.result == 'success' }}
    runs-on: "ubuntu-20.04"
    env:
      GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    steps:
      - uses: actions/checkout@v4
        with:
          submodules: recursive
      - name: "Download Github Artifacts"
        uses: actions/download-artifact@v4
        with:
          pattern: artifacts-*
          path: artifacts
          merge-multiple: true
      - name: Cleanup
        run: |
          # Remove the granular manifests
          rm -f artifacts/*-dist-manifest.json
      - name: Create Github Release
        uses: ncipollo/release-action@v1
        with:
          tag: ${{ needs.plan.outputs.tag }}
          name: ${{ fromJson(needs.host.outputs.val).announcement_title }}
          body: ${{ fromJson(needs.host.outputs.val).announcement_github_body }}
          prerelease: ${{ fromJson(needs.host.outputs.val).announcement_is_prerelease }}
          artifacts: "artifacts/*"


-----------------------

/.github/workflows/update-dependencies.sh:
-----------------------

#!/usr/bin/env bash

# Usage: .github/workflows/update-dependencies.sh EXTENSION NEW_VERSION
# Run from project root

EXTENSION=$1
NEW_VERSION=$2

if [ -z "$EXTENSION" ] || [ -z "$NEW_VERSION" ]; then
  echo "Usage: $0 EXTENSION NEW_VERSION"
  exit 1
fi

EXTENSION_JSON="extensions/$EXTENSION/extension.json"
DEPENDENCIES_JSON="extensions/$EXTENSION/dependencies.json"

# Copy 'dependencies' field from extension.json to dependencies.json for the new version
jq --slurpfile extension "$EXTENSION_JSON" --arg version "$NEW_VERSION" '
  .[$version] = (reduce ($extension[0].dependencies | to_entries[]) as $dep (
    {}; .[$dep.key] = (if $dep.value | type == "string" # normalize short-form version strings
                       then {"version": $dep.value}     # to object with "version" key,
                       else $dep.value                  # leave others as-is
                       end)
  ))
  | {($version): .[$version]} + .                       # add new version as first entry
' "$DEPENDENCIES_JSON" | sponge "$DEPENDENCIES_JSON"


-----------------------

/.gitignore:
-----------------------

# OS-, or IDE-specific
.DS_Store
.AppleDouble
.LSOverride
.idea

# Rust
## Generated by Cargo (compiled files and executables)
debug/
target/

## These are backup files generated by rustfmt
**/*.rs.bk

## MSVC Windows builds of rustc generate these, which store debugging information
*.pdb

## don't include binaries that are downloaded in build.rs scripts
extensions/sns/sns-cli
extensions/nns/ic-admin
extensions/nns/ic-nns-init
extensions/nns/sns-cli


-----------------------

/.gitmodules:
-----------------------

[submodule "e2e/bats"]
	path = e2e/bats
	url = https://github.com/bats-core/bats-core.git
[submodule "e2e/bats-support"]
	path = e2e/bats-support
	url = https://github.com/bats-core/bats-support.git
[submodule "e2e/bats-assert"]
	path = e2e/bats-assert
	url = https://github.com/bats-core/bats-assert.git


-----------------------

/CODEOWNERS:
-----------------------

* @dfinity/sdk @dfinity/nns-team


-----------------------

/Cargo.lock:
-----------------------

# This file is automatically @generated by Cargo.
# It is not intended for manual editing.
version = 3

[[package]]
name = "addr2line"
version = "0.24.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "f5fb1d8e4442bd405fdfd1dacb42792696b0cf9cb15882e5d097b742a676d375"
dependencies = [
 "gimli 0.31.0",
]

[[package]]
name = "adler2"
version = "2.0.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "512761e0bb2578dd7380c6baaa0f4ce03e84f95e960231d1dec8bf4d7d6e2627"

[[package]]
name = "adler32"
version = "1.2.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "aae1277d39aeec15cb388266ecc24b11c80469deae6067e17a1a7aa9e5c1f234"

[[package]]
name = "aead"
version = "0.5.2"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "d122413f284cf2d62fb1b7db97e02edb8cda96d769b16e443a4f6195e35662b0"
dependencies = [
 "crypto-common",
 "generic-array",
]

[[package]]
name = "aes"
version = "0.7.5"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "9e8b47f52ea9bae42228d07ec09eb676433d7c4ed1ebdf0f1d1c29ed446f1ab8"
dependencies = [
 "cfg-if",
 "cipher 0.3.0",
 "cpufeatures",
 "opaque-debug",
]

[[package]]
name = "aes"
version = "0.8.4"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "b169f7a6d4742236a0a00c541b845991d0ac43e546831af1249753ab4c3aa3a0"
dependencies = [
 "cfg-if",
 "cipher 0.4.4",
 "cpufeatures",
]

[[package]]
name = "aes-gcm"
version = "0.10.3"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "831010a0f742e1209b3bcea8fab6a8e149051ba6099432c8cb2cc117dec3ead1"
dependencies = [
 "aead",
 "aes 0.8.4",
 "cipher 0.4.4",
 "ctr",
 "ghash",
 "subtle",
]

[[package]]
name = "ahash"
version = "0.7.8"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "891477e0c6a8957309ee5c45a6368af3ae14bb510732d2684ffa19af310920f9"
dependencies = [
 "getrandom",
 "once_cell",
 "version_check",
]

[[package]]
name = "ahash"
version = "0.8.11"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "e89da841a80418a9b391ebaea17f5c112ffaaa96f621d2c285b5174da76b9011"
dependencies = [
 "cfg-if",
 "once_cell",
 "version_check",
 "zerocopy",
]

[[package]]
name = "aho-corasick"
version = "1.1.3"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "8e60d3430d3a69478ad0993f19238d2df97c507009a52b3c10addcd7f6bcb916"
dependencies = [
 "memchr",
]

[[package]]
name = "allocator-api2"
version = "0.2.18"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "5c6cb57a04249c6480766f7f7cef5467412af1490f8d1e243141daddada3264f"

[[package]]
name = "android-tzdata"
version = "0.1.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "e999941b234f3131b00bc13c22d06e8c5ff726d1b6318ac7eb276997bbb4fef0"

[[package]]
name = "android_system_properties"
version = "0.1.5"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "819e7219dbd41043ac279b19830f2efc897156490d7fd6ea916720117ee66311"
dependencies = [
 "libc",
]

[[package]]
name = "anstream"
version = "0.6.15"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "64e15c1ab1f89faffbf04a634d5e1962e9074f2741eef6d97f3c4e322426d526"
dependencies = [
 "anstyle",
 "anstyle-parse",
 "anstyle-query",
 "anstyle-wincon",
 "colorchoice",
 "is_terminal_polyfill",
 "utf8parse",
]

[[package]]
name = "anstyle"
version = "1.0.8"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "1bec1de6f59aedf83baf9ff929c98f2ad654b97c9510f4e70cf6f661d49fd5b1"

[[package]]
name = "anstyle-parse"
version = "0.2.5"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "eb47de1e80c2b463c735db5b217a0ddc39d612e7ac9e2e96a5aed1f57616c1cb"
dependencies = [
 "utf8parse",
]

[[package]]
name = "anstyle-query"
version = "1.1.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "6d36fc52c7f6c869915e99412912f22093507da8d9e942ceaf66fe4b7c14422a"
dependencies = [
 "windows-sys 0.52.0",
]

[[package]]
name = "anstyle-wincon"
version = "3.0.4"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "5bf74e1b6e971609db8ca7a9ce79fd5768ab6ae46441c572e46cf596f59e57f8"
dependencies = [
 "anstyle",
 "windows-sys 0.52.0",
]

[[package]]
name = "anyhow"
version = "1.0.88"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "4e1496f8fb1fbf272686b8d37f523dab3e4a7443300055e74cdaa449f3114356"

[[package]]
name = "arc-swap"
version = "1.7.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "69f7f8c3906b62b754cd5326047894316021dcfe5a194c8ea52bdd94934a3457"

[[package]]
name = "argon2"
version = "0.4.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "db4ce4441f99dbd377ca8a8f57b698c44d0d6e712d8329b5040da5a64aa1ce73"
dependencies = [
 "base64ct",
 "blake2",
 "password-hash",
]

[[package]]
name = "arrayvec"
version = "0.5.2"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "23b62fc65de8e4e7f52534fb52b0f3ed04746ae267519eef2a83941e8085068b"

[[package]]
name = "arrayvec"
version = "0.7.6"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "7c02d123df017efcdfbd739ef81735b36c5ba83ec3c59c80a9d7ecc718f92e50"

[[package]]
name = "async-io"
version = "1.13.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "0fc5b45d93ef0529756f812ca52e44c221b35341892d3dcc34132ac02f3dd2af"
dependencies = [
 "async-lock 2.8.0",
 "autocfg",
 "cfg-if",
 "concurrent-queue",
 "futures-lite",
 "log",
 "parking",
 "polling",
 "rustix 0.37.27",
 "slab",
 "socket2 0.4.10",
 "waker-fn",
]

[[package]]
name = "async-lock"
version = "2.8.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "287272293e9d8c41773cec55e365490fe034813a2f172f502d6ddcf75b2f582b"
dependencies = [
 "event-listener 2.5.3",
]

[[package]]
name = "async-lock"
version = "3.4.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "ff6e472cdea888a4bd64f342f09b3f50e1886d32afe8df3d663c01140b811b18"
dependencies = [
 "event-listener 5.3.1",
 "event-listener-strategy",
 "pin-project-lite",
]

[[package]]
name = "async-trait"
version = "0.1.82"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "a27b8a3a6e1a44fa4c8baf1f653e4172e81486d4941f2237e20dc2d0cf4ddff1"
dependencies = [
 "proc-macro2",
 "quote",
 "syn 2.0.77",
]

[[package]]
name = "atomic-waker"
version = "1.1.2"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "1505bd5d3d116872e7271a6d4e16d81d0c8570876c8de68093a09ac269d8aac0"

[[package]]
name = "atty"
version = "0.2.14"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "d9b39be18770d11421cdb1b9947a45dd3f37e93092cbf377614828a319d5fee8"
dependencies = [
 "hermit-abi 0.1.19",
 "libc",
 "winapi",
]

[[package]]
name = "autocfg"
version = "1.3.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "0c4b4d0bd25bd0b74681c0ad21497610ce1b7c91b1022cd21c80c6fbdd9476b0"

[[package]]
name = "backoff"
version = "0.4.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "b62ddb9cb1ec0a098ad4bbf9344d0713fa193ae1a80af55febcff2627b6a00c1"
dependencies = [
 "futures-core",
 "getrandom",
 "instant",
 "pin-project-lite",
 "rand",
 "tokio",
]

[[package]]
name = "backtrace"
version = "0.3.74"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "8d82cb332cdfaed17ae235a638438ac4d4839913cc2af585c3c6746e8f8bee1a"
dependencies = [
 "addr2line",
 "cfg-if",
 "libc",
 "miniz_oxide",
 "object",
 "rustc-demangle",
 "windows-targets 0.52.6",
]

[[package]]
name = "base16ct"
version = "0.1.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "349a06037c7bf932dd7e7d1f653678b2038b9ad46a74102f1fc7bd7872678cce"

[[package]]
name = "base16ct"
version = "0.2.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "4c7f02d4ea65f2c1853089ffd8d2787bdbc63de2f0d29dedbcf8ccdfa0ccd4cf"

[[package]]
name = "base32"
version = "0.4.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "23ce669cd6c8588f79e15cf450314f9638f967fc5770ff1c7c1deb0925ea7cfa"

[[package]]
name = "base64"
version = "0.13.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "9e1b586273c5702936fe7b7d6896644d8be71e6314cfe09d3167c95f712589e8"

[[package]]
name = "base64"
version = "0.21.7"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "9d297deb1925b89f2ccc13d7635fa0714f12c87adce1c75356b39ca9b7178567"

[[package]]
name = "base64"
version = "0.22.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "72b3254f16251a8381aa12e40e3c4d2f0199f8c6508fbecb9d91f575e0fbb8c6"

[[package]]
name = "base64ct"
version = "1.6.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "8c3c1a368f70d6cf7302d78f8f7093da241fb8e8807c05cc9e51a125895a6d5b"

[[package]]
name = "bincode"
version = "1.3.3"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "b1f45e9417d87227c7a56d22e471c6206462cba514c7590c09aff4cf6d1ddcad"
dependencies = [
 "serde",
]

[[package]]
name = "binread"
version = "2.2.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "16598dfc8e6578e9b597d9910ba2e73618385dc9f4b1d43dd92c349d6be6418f"
dependencies = [
 "binread_derive",
 "lazy_static",
 "rustversion",
]

[[package]]
name = "binread_derive"
version = "2.1.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "1d9672209df1714ee804b1f4d4f68c8eb2a90b1f7a07acf472f88ce198ef1fed"
dependencies = [
 "either",
 "proc-macro2",
 "quote",
 "syn 1.0.109",
]

[[package]]
name = "bip32"
version = "0.4.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "b30ed1d6f8437a487a266c8293aeb95b61a23261273e3e02912cdb8b68bf798b"
dependencies = [
 "bs58",
 "hmac 0.12.1",
 "k256 0.11.6",
 "once_cell",
 "pbkdf2",
 "rand_core",
 "ripemd",
 "sha2 0.10.8",
 "subtle",
 "zeroize",
]

[[package]]
name = "bitflags"
version = "1.3.2"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "bef38d45163c2f1dde094a7dfd33ccf595c92905c8f8f4fdc18d06fb1037718a"

[[package]]
name = "bitflags"
version = "2.6.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "b048fb63fd8b5923fc5aa7b340d8e156aec7ec02f0c78fa8a6ddc2613f6f71de"

[[package]]
name = "bitvec"
version = "1.0.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "1bc2832c24239b0141d5674bb9174f9d68a8b5b3f2753311927c172ca46f7e9c"
dependencies = [
 "funty",
 "radium",
 "tap",
 "wyz",
]

[[package]]
name = "blake2"
version = "0.10.6"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "46502ad458c9a52b69d4d4d32775c788b7a1b85e8bc9d482d92250fc0e3f8efe"
dependencies = [
 "digest 0.10.7",
]

[[package]]
name = "block-buffer"
version = "0.9.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "4152116fd6e9dadb291ae18fc1ec3575ed6d84c29642d97890f4b4a3417297e4"
dependencies = [
 "generic-array",
]

[[package]]
name = "block-buffer"
version = "0.10.4"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "3078c7629b62d3f0439517fa394996acacc5cbc91c5a20d8c658e77abd503a71"
dependencies = [
 "generic-array",
]

[[package]]
name = "block-modes"
version = "0.8.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "2cb03d1bed155d89dce0f845b7899b18a9a163e148fd004e1c28421a783e2d8e"
dependencies = [
 "block-padding",
 "cipher 0.3.0",
]

[[package]]
name = "block-padding"
version = "0.2.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "8d696c370c750c948ada61c69a0ee2cbbb9c50b1019ddb86d9317157a99c2cae"

[[package]]
name = "borsh"
version = "1.5.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "a6362ed55def622cddc70a4746a68554d7b687713770de539e59a739b249f8ed"
dependencies = [
 "borsh-derive",
 "cfg_aliases",
]

[[package]]
name = "borsh-derive"
version = "1.5.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "c3ef8005764f53cd4dca619f5bf64cafd4664dada50ece25e4d81de54c80cc0b"
dependencies = [
 "once_cell",
 "proc-macro-crate 3.2.0",
 "proc-macro2",
 "quote",
 "syn 2.0.77",
 "syn_derive",
]

[[package]]
name = "bs58"
version = "0.4.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "771fe0050b883fcc3ea2359b1a96bcfbc090b7116eae7c3c512c7a083fdf23d3"
dependencies = [
 "sha2 0.9.9",
]

[[package]]
name = "build-info"
version = "0.0.27"
source = "git+https://github.com/dfinity-lab/build-info?rev=701a696844fba5c87df162fbbc1ccef96f27c9d7#701a696844fba5c87df162fbbc1ccef96f27c9d7"
dependencies = [
 "build-info-common",
 "build-info-proc",
 "lazy_static",
 "proc-macro-hack",
]

[[package]]
name = "build-info-build"
version = "0.0.27"
source = "git+https://github.com/dfinity-lab/build-info?rev=701a696844fba5c87df162fbbc1ccef96f27c9d7#701a696844fba5c87df162fbbc1ccef96f27c9d7"
dependencies = [
 "anyhow",
 "base64 0.13.1",
 "bincode",
 "build-info-common",
 "cargo_metadata",
 "glob",
 "lazy_static",
 "pretty_assertions",
 "rustc_version",
 "serde_json",
 "xz2",
]

[[package]]
name = "build-info-common"
version = "0.0.27"
source = "git+https://github.com/dfinity-lab/build-info?rev=701a696844fba5c87df162fbbc1ccef96f27c9d7#701a696844fba5c87df162fbbc1ccef96f27c9d7"
dependencies = [
 "derive_more",
 "semver",
 "serde",
]

[[package]]
name = "build-info-proc"
version = "0.0.27"
source = "git+https://github.com/dfinity-lab/build-info?rev=701a696844fba5c87df162fbbc1ccef96f27c9d7#701a696844fba5c87df162fbbc1ccef96f27c9d7"
dependencies = [
 "anyhow",
 "base64 0.13.1",
 "bincode",
 "build-info-common",
 "num-bigint 0.4.6",
 "num-traits",
 "proc-macro-error",
 "proc-macro-hack",
 "proc-macro2",
 "quote",
 "serde_json",
 "syn 1.0.109",
 "xz2",
]

[[package]]
name = "bumpalo"
version = "3.16.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "79296716171880943b8470b5f8d03aa55eb2e645a4874bdbb28adb49162e012c"

[[package]]
name = "by_address"
version = "1.2.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "64fa3c856b712db6612c019f14756e64e4bcea13337a6b33b696333a9eaa2d06"

[[package]]
name = "byte-unit"
version = "4.0.19"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "da78b32057b8fdfc352504708feeba7216dcd65a2c9ab02978cbd288d1279b6c"
dependencies = [
 "serde",
 "utf8-width",
]

[[package]]
name = "bytecheck"
version = "0.6.12"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "23cdc57ce23ac53c931e88a43d06d070a6fd142f2617be5855eb75efc9beb1c2"
dependencies = [
 "bytecheck_derive",
 "ptr_meta",
 "simdutf8",
]

[[package]]
name = "bytecheck_derive"
version = "0.6.12"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "3db406d29fbcd95542e92559bed4d8ad92636d1ca8b3b72ede10b4bcc010e659"
dependencies = [
 "proc-macro2",
 "quote",
 "syn 1.0.109",
]

[[package]]
name = "byteorder"
version = "1.5.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "1fd0f2584146f6f2ef48085050886acf353beff7305ebd1ae69500e27c67f64b"

[[package]]
name = "bytes"
version = "1.7.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "8318a53db07bb3f8dca91a600466bdb3f2eaadeedfdbcf02e1accbad9271ba50"

[[package]]
name = "cached"
version = "0.52.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "a8466736fe5dbcaf8b8ee24f9bbefe43c884dc3e9ff7178da70f55bffca1133c"
dependencies = [
 "ahash 0.8.11",
 "hashbrown 0.14.5",
 "instant",
 "once_cell",
 "thiserror",
]

[[package]]
name = "camino"
version = "1.1.9"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "8b96ec4966b5813e2c0507c1f86115c8c5abaadc3980879c3424042a02fd1ad3"
dependencies = [
 "serde",
]

[[package]]
name = "candid"
version = "0.10.10"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "6c30ee7f886f296b6422c0ff017e89dd4f831521dfdcc76f3f71aae1ce817222"
dependencies = [
 "anyhow",
 "binread",
 "byteorder",
 "candid_derive",
 "hex",
 "ic_principal",
 "leb128",
 "num-bigint 0.4.6",
 "num-traits",
 "paste",
 "pretty",
 "serde",
 "serde_bytes",
 "stacker",
 "thiserror",
]

[[package]]
name = "candid_derive"
version = "0.6.6"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "3de398570c386726e7a59d9887b68763c481477f9a043fb998a2e09d428df1a9"
dependencies = [
 "lazy_static",
 "proc-macro2",
 "quote",
 "syn 2.0.77",
]

[[package]]
name = "cargo-platform"
version = "0.1.8"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "24b1f0365a6c6bb4020cd05806fd0d33c44d38046b8bd7f0e40814b9763cabfc"
dependencies = [
 "serde",
]

[[package]]
name = "cargo_metadata"
version = "0.14.2"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "4acbb09d9ee8e23699b9634375c72795d095bf268439da88562cf9b501f181fa"
dependencies = [
 "camino",
 "cargo-platform",
 "semver",
 "serde",
 "serde_json",
]

[[package]]
name = "cc"
version = "1.1.18"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "b62ac837cdb5cb22e10a256099b4fc502b1dfe560cb282963a974d7abd80e476"
dependencies = [
 "jobserver",
 "libc",
 "shlex",
]

[[package]]
name = "cfg-if"
version = "1.0.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "baf1de4339761588bc0619e3cbc0120ee582ebb74b53b4efbf79117bd2da40fd"

[[package]]
name = "cfg_aliases"
version = "0.2.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "613afe47fcd5fac7ccf1db93babcb082c5994d996f20b8b159f2ad1658eb5724"

[[package]]
name = "chrono"
version = "0.4.38"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "a21f936df1771bf62b77f047b726c4625ff2e8aa607c01ec06e5a05bd8463401"
dependencies = [
 "android-tzdata",
 "iana-time-zone",
 "num-traits",
 "serde",
 "windows-targets 0.52.6",
]

[[package]]
name = "ciborium"
version = "0.2.2"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "42e69ffd6f0917f5c029256a24d0161db17cea3997d185db0d35926308770f0e"
dependencies = [
 "ciborium-io",
 "ciborium-ll",
 "serde",
]

[[package]]
name = "ciborium-io"
version = "0.2.2"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "05afea1e0a06c9be33d539b876f1ce3692f4afea2cb41f740e7743225ed1c757"

[[package]]
name = "ciborium-ll"
version = "0.2.2"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "57663b653d948a338bfb3eeba9bb2fd5fcfaecb9e199e87e1eda4d9e8b240fd9"
dependencies = [
 "ciborium-io",
 "half 2.4.1",
]

[[package]]
name = "cipher"
version = "0.3.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "7ee52072ec15386f770805afd189a01c8841be8696bed250fa2f13c4c0d6dfb7"
dependencies = [
 "generic-array",
]

[[package]]
name = "cipher"
version = "0.4.4"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "773f3b9af64447d2ce9850330c473515014aa235e6a783b02db81ff39e4a3dad"
dependencies = [
 "crypto-common",
 "inout",
]

[[package]]
name = "clap"
version = "3.2.25"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "4ea181bf566f71cb9a5d17a59e1871af638180a18fb0035c92ae62b705207123"
dependencies = [
 "atty",
 "bitflags 1.3.2",
 "clap_derive 3.2.25",
 "clap_lex 0.2.4",
 "indexmap 1.9.3",
 "once_cell",
 "strsim 0.10.0",
 "termcolor",
 "textwrap",
]

[[package]]
name = "clap"
version = "4.5.17"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "3e5a21b8495e732f1b3c364c9949b201ca7bae518c502c80256c96ad79eaf6ac"
dependencies = [
 "clap_builder",
 "clap_derive 4.5.13",
]

[[package]]
name = "clap_builder"
version = "4.5.17"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "8cf2dd12af7a047ad9d6da2b6b249759a22a7abc0f474c1dae1777afa4b21a73"
dependencies = [
 "anstream",
 "anstyle",
 "clap_lex 0.7.2",
 "strsim 0.11.1",
]

[[package]]
name = "clap_derive"
version = "3.2.25"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "ae6371b8bdc8b7d3959e9cf7b22d4435ef3e79e138688421ec654acf8c81b008"
dependencies = [
 "heck 0.4.1",
 "proc-macro-error",
 "proc-macro2",
 "quote",
 "syn 1.0.109",
]

[[package]]
name = "clap_derive"
version = "4.5.13"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "501d359d5f3dcaf6ecdeee48833ae73ec6e42723a1e52419c79abf9507eec0a0"
dependencies = [
 "heck 0.5.0",
 "proc-macro2",
 "quote",
 "syn 2.0.77",
]

[[package]]
name = "clap_lex"
version = "0.2.4"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "2850f2f5a82cbf437dd5af4d49848fbdfc27c157c3d010345776f952765261c5"
dependencies = [
 "os_str_bytes",
]

[[package]]
name = "clap_lex"
version = "0.7.2"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "1462739cb27611015575c0c11df5df7601141071f07518d56fcc1be504cbec97"

[[package]]
name = "cmake"
version = "0.1.51"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "fb1e43aa7fd152b1f968787f7dbcdeb306d1867ff373c69955211876c053f91a"
dependencies = [
 "cc",
]

[[package]]
name = "colorchoice"
version = "1.0.2"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "d3fd119d74b830634cea2a0f58bbd0d54540518a14397557951e79340abc28c0"

[[package]]
name = "comparable"
version = "0.5.4"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "eb513ee8037bf08c5270ecefa48da249f4c58e57a71ccfce0a5b0877d2a20eb2"
dependencies = [
 "comparable_derive",
 "comparable_helper",
 "pretty_assertions",
 "serde",
]

[[package]]
name = "comparable_derive"
version = "0.5.4"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "a54b9c40054eb8999c5d1d36fdc90e4e5f7ff0d1d9621706f360b3cbc8beb828"
dependencies = [
 "convert_case 0.4.0",
 "proc-macro2",
 "quote",
 "syn 1.0.109",
]

[[package]]
name = "comparable_helper"
version = "0.5.4"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "fb5437e327e861081c91270becff184859f706e3e50f5301a9d4dc8eb50752c3"
dependencies = [
 "convert_case 0.6.0",
 "proc-macro2",
 "quote",
 "syn 1.0.109",
]

[[package]]
name = "concurrent-queue"
version = "2.5.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "4ca0197aee26d1ae37445ee532fefce43251d24cc7c166799f4d46817f1d3973"
dependencies = [
 "crossbeam-utils",
]

[[package]]
name = "console"
version = "0.15.8"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "0e1f83fc076bd6dd27517eacdf25fef6c4dfe5f1d7448bafaaf3a26f13b5e4eb"
dependencies = [
 "encode_unicode",
 "lazy_static",
 "libc",
 "unicode-width",
 "windows-sys 0.52.0",
]

[[package]]
name = "const-oid"
version = "0.9.6"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "c2459377285ad874054d797f3ccebf984978aa39129f6eafde5cdc8315b612f8"

[[package]]
name = "convert_case"
version = "0.4.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "6245d59a3e82a7fc217c5828a6692dbc6dfb63a0c8c90495621f7b9d79704a0e"

[[package]]
name = "convert_case"
version = "0.6.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "ec182b0ca2f35d8fc196cf3404988fd8b8c739a4d270ff118a398feb0cbec1ca"
dependencies = [
 "unicode-segmentation",
]

[[package]]
name = "core-foundation"
version = "0.9.4"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "91e195e091a93c46f7102ec7818a2aa394e1e1771c3ab4825963fa03e45afb8f"
dependencies = [
 "core-foundation-sys",
 "libc",
]

[[package]]
name = "core-foundation-sys"
version = "0.8.7"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "773648b94d0e5d620f64f280777445740e61fe701025087ec8b57f45c791888b"

[[package]]
name = "core2"
version = "0.4.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "b49ba7ef1ad6107f8824dbe97de947cbaac53c44e7f9756a1fba0d37c1eec505"
dependencies = [
 "memchr",
]

[[package]]
name = "cpufeatures"
version = "0.2.14"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "608697df725056feaccfa42cffdaeeec3fccc4ffc38358ecd19b243e716a78e0"
dependencies = [
 "libc",
]

[[package]]
name = "crc32fast"
version = "1.4.2"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "a97769d94ddab943e4510d138150169a2758b5ef3eb191a9ee688de3e23ef7b3"
dependencies = [
 "cfg-if",
]

[[package]]
name = "crossbeam-channel"
version = "0.5.13"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "33480d6946193aa8033910124896ca395333cae7e2d1113d1fef6c3272217df2"
dependencies = [
 "crossbeam-utils",
]

[[package]]
name = "crossbeam-utils"
version = "0.8.20"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "22ec99545bb0ed0ea7bb9b8e1e9122ea386ff8a48c0922e43f36d45ab09e0e80"

[[package]]
name = "crunchy"
version = "0.2.2"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "7a81dae078cea95a014a339291cec439d2f232ebe854a9d672b796c6afafa9b7"

[[package]]
name = "crypto-bigint"
version = "0.4.9"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "ef2b4b23cddf68b89b8f8069890e8c270d54e2d5fe1b143820234805e4cb17ef"
dependencies = [
 "generic-array",
 "rand_core",
 "subtle",
 "zeroize",
]

[[package]]
name = "crypto-bigint"
version = "0.5.5"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "0dc92fb57ca44df6db8059111ab3af99a63d5d0f8375d9972e319a379c6bab76"
dependencies = [
 "generic-array",
 "rand_core",
 "subtle",
 "zeroize",
]

[[package]]
name = "crypto-common"
version = "0.1.6"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "1bfb12502f3fc46cca1bb51ac28df9d618d813cdc3d2f25b9fe775a34af26bb3"
dependencies = [
 "generic-array",
 "rand_core",
 "typenum",
]

[[package]]
name = "crypto-mac"
version = "0.11.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "25fab6889090c8133f3deb8f73ba3c65a7f456f66436fc012a1b1e272b1e103e"
dependencies = [
 "generic-array",
 "subtle",
]

[[package]]
name = "ctr"
version = "0.9.2"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "0369ee1ad671834580515889b80f2ea915f23b8be8d0daa4bbaf2ac5c7590835"
dependencies = [
 "cipher 0.4.4",
]

[[package]]
name = "curve25519-dalek"
version = "4.1.3"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "97fb8b7c4503de7d6ae7b42ab72a5a59857b4c937ec27a3d4539dba95b5ab2be"
dependencies = [
 "cfg-if",
 "cpufeatures",
 "curve25519-dalek-derive",
 "digest 0.10.7",
 "fiat-crypto",
 "group 0.13.0",
 "rand_core",
 "rustc_version",
 "subtle",
 "zeroize",
]

[[package]]
name = "curve25519-dalek-derive"
version = "0.1.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "f46882e17999c6cc590af592290432be3bce0428cb0d5f8b6715e4dc7b383eb3"
dependencies = [
 "proc-macro2",
 "quote",
 "syn 2.0.77",
]

[[package]]
name = "curve25519-dalek-ng"
version = "4.1.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "1c359b7249347e46fb28804470d071c921156ad62b3eef5d34e2ba867533dec8"
dependencies = [
 "byteorder",
 "digest 0.9.0",
 "rand_core",
 "subtle-ng",
 "zeroize",
]

[[package]]
name = "cvt"
version = "0.1.2"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "d2ae9bf77fbf2d39ef573205d554d87e86c12f1994e9ea335b0651b9b278bcf1"
dependencies = [
 "cfg-if",
]

[[package]]
name = "cycles-minting-canister"
version = "0.9.0"
source = "git+https://github.com/dfinity/ic?rev=f7e561c00a2745f946372f5166fd7968fa664f53#f7e561c00a2745f946372f5166fd7968fa664f53"
dependencies = [
 "async-trait",
 "base64 0.13.1",
 "build-info",
 "build-info-build",
 "candid",
 "dfn_candid",
 "dfn_core",
 "dfn_http_metrics",
 "dfn_protobuf",
 "ic-base-types",
 "ic-certified-map",
 "ic-crypto-getrandom-for-wasm",
 "ic-crypto-tree-hash",
 "ic-ledger-core",
 "ic-management-canister-types",
 "ic-metrics-encoder",
 "ic-nervous-system-common",
 "ic-nervous-system-common-build-metadata",
 "ic-nervous-system-governance",
 "ic-nns-common",
 "ic-nns-constants",
 "ic-protobuf",
 "ic-types",
 "ic-xrc-types",
 "icp-ledger",
 "icrc-ledger-types",
 "lazy_static",
 "on_wire",
 "prost",
 "rand",
 "serde",
 "serde_cbor",
 "sha2 0.10.8",
 "yansi",
]

[[package]]
name = "darling"
version = "0.13.4"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "a01d95850c592940db9b8194bc39f4bc0e89dee5c4265e4b1807c34a9aba453c"
dependencies = [
 "darling_core 0.13.4",
 "darling_macro 0.13.4",
]

[[package]]
name = "darling"
version = "0.20.10"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "6f63b86c8a8826a49b8c21f08a2d07338eec8d900540f8630dc76284be802989"
dependencies = [
 "darling_core 0.20.10",
 "darling_macro 0.20.10",
]

[[package]]
name = "darling_core"
version = "0.13.4"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "859d65a907b6852c9361e3185c862aae7fafd2887876799fa55f5f99dc40d610"
dependencies = [
 "fnv",
 "ident_case",
 "proc-macro2",
 "quote",
 "strsim 0.10.0",
 "syn 1.0.109",
]

[[package]]
name = "darling_core"
version = "0.20.10"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "95133861a8032aaea082871032f5815eb9e98cef03fa916ab4500513994df9e5"
dependencies = [
 "fnv",
 "ident_case",
 "proc-macro2",
 "quote",
 "strsim 0.11.1",
 "syn 2.0.77",
]

[[package]]
name = "darling_macro"
version = "0.13.4"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "9c972679f83bdf9c42bd905396b6c3588a843a17f0f16dfcfa3e2c5d57441835"
dependencies = [
 "darling_core 0.13.4",
 "quote",
 "syn 1.0.109",
]

[[package]]
name = "darling_macro"
version = "0.20.10"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "d336a2a514f6ccccaa3e09b02d41d35330c07ddf03a62165fcec10bb561c7806"
dependencies = [
 "darling_core 0.20.10",
 "quote",
 "syn 2.0.77",
]

[[package]]
name = "dary_heap"
version = "0.3.6"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "7762d17f1241643615821a8455a0b2c3e803784b058693d990b11f2dce25a0ca"

[[package]]
name = "data-encoding"
version = "2.6.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "e8566979429cf69b49a5c740c60791108e86440e8be149bbea4fe54d2c32d6e2"

[[package]]
name = "der"
version = "0.6.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "f1a467a65c5e759bce6e65eaf91cc29f466cdc57cb65777bd646872a8a1fd4de"
dependencies = [
 "const-oid",
 "pem-rfc7468 0.6.0",
 "zeroize",
]

[[package]]
name = "der"
version = "0.7.9"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "f55bf8e7b65898637379c1b74eb1551107c8294ed26d855ceb9fd1a09cfc9bc0"
dependencies = [
 "const-oid",
 "pem-rfc7468 0.7.0",
 "zeroize",
]

[[package]]
name = "deranged"
version = "0.3.11"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "b42b6fa04a440b495c8b04d0e71b707c585f83cb9cb28cf8cd0d976c315e31b4"
dependencies = [
 "powerfmt",
 "serde",
]

[[package]]
name = "derivative"
version = "2.2.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "fcc3dd5e9e9c0b295d6e1e4d811fb6f157d5ffd784b8d202fc62eac8035a770b"
dependencies = [
 "proc-macro2",
 "quote",
 "syn 1.0.109",
]

[[package]]
name = "derive_more"
version = "0.99.18"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "5f33878137e4dafd7fa914ad4e259e18a4e8e532b9617a2d0150262bf53abfce"
dependencies = [
 "convert_case 0.4.0",
 "proc-macro2",
 "quote",
 "rustc_version",
 "syn 2.0.77",
]

[[package]]
name = "dfn_candid"
version = "0.9.0"
source = "git+https://github.com/dfinity/ic?rev=f7e561c00a2745f946372f5166fd7968fa664f53#f7e561c00a2745f946372f5166fd7968fa664f53"
dependencies = [
 "candid",
 "dfn_core",
 "ic-base-types",
 "on_wire",
 "serde",
]

[[package]]
name = "dfn_core"
version = "0.9.0"
source = "git+https://github.com/dfinity/ic?rev=f7e561c00a2745f946372f5166fd7968fa664f53#f7e561c00a2745f946372f5166fd7968fa664f53"
dependencies = [
 "ic-base-types",
 "on_wire",
]

[[package]]
name = "dfn_http"
version = "0.9.0"
source = "git+https://github.com/dfinity/ic?rev=f7e561c00a2745f946372f5166fd7968fa664f53#f7e561c00a2745f946372f5166fd7968fa664f53"
dependencies = [
 "candid",
 "dfn_candid",
 "dfn_core",
 "serde",
 "serde_bytes",
]

[[package]]
name = "dfn_http_metrics"
version = "0.9.0"
source = "git+https://github.com/dfinity/ic?rev=f7e561c00a2745f946372f5166fd7968fa664f53#f7e561c00a2745f946372f5166fd7968fa664f53"
dependencies = [
 "dfn_candid",
 "dfn_core",
 "dfn_http",
 "ic-canisters-http-types",
 "ic-metrics-encoder",
 "serde_bytes",
]

[[package]]
name = "dfn_protobuf"
version = "0.9.0"
source = "git+https://github.com/dfinity/ic?rev=f7e561c00a2745f946372f5166fd7968fa664f53#f7e561c00a2745f946372f5166fd7968fa664f53"
dependencies = [
 "on_wire",
 "prost",
]

[[package]]
name = "dfx-core"
version = "0.0.1"
source = "git+https://github.com/dfinity/sdk?rev=993ae6df38caef8aae5291570b78954334d16b21#993ae6df38caef8aae5291570b78954334d16b21"
dependencies = [
 "aes-gcm",
 "argon2",
 "backoff",
 "bip32",
 "byte-unit",
 "bytes",
 "candid",
 "clap 4.5.17",
 "dialoguer",
 "directories-next",
 "dunce",
 "flate2",
 "handlebars",
 "hex",
 "humantime-serde",
 "ic-agent 0.37.1 (git+https://github.com/dfinity/agent-rs?rev=6e11a350112f9b907c4d590d8217f340e153d898)",
 "ic-identity-hsm",
 "ic-utils 0.37.1",
 "itertools 0.10.5",
 "k256 0.11.6",
 "keyring",
 "lazy_static",
 "reqwest 0.12.7",
 "ring 0.16.20",
 "schemars",
 "sec1 0.3.0",
 "semver",
 "serde",
 "serde_json",
 "sha2 0.10.8",
 "slog",
 "tar",
 "tempfile",
 "thiserror",
 "time",
 "tiny-bip39",
 "url",
]

[[package]]
name = "dfx-extensions-utils"
version = "0.0.0"
dependencies = [
 "anyhow",
 "backoff",
 "candid",
 "clap 4.5.17",
 "dfx-core",
 "flate2",
 "fn-error-context",
 "futures-util",
 "hyper-rustls 0.23.2",
 "reqwest 0.11.27",
 "rustls 0.20.9",
 "semver",
 "serde",
 "serde_json",
 "slog",
 "slog-async",
 "slog-term",
 "tempfile",
 "thiserror",
 "tokio",
 "url",
]

[[package]]
name = "dialoguer"
version = "0.11.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "658bce805d770f407bc62102fca7c2c64ceef2fbcb2b8bd19d2765ce093980de"
dependencies = [
 "console",
 "shell-words",
 "tempfile",
 "thiserror",
 "zeroize",
]

[[package]]
name = "diff"
version = "0.1.13"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "56254986775e3233ffa9c4d7d3faaf6d36a2c09d30b20687e9f88bc8bafc16c8"

[[package]]
name = "digest"
version = "0.9.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "d3dd60d1080a57a05ab032377049e0591415d2b31afd7028356dbf3cc6dcb066"
dependencies = [
 "generic-array",
]

[[package]]
name = "digest"
version = "0.10.7"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "9ed9a281f7bc9b7576e61468ba615a66a5c8cfdff42420a70aa82701a3b1e292"
dependencies = [
 "block-buffer 0.10.4",
 "const-oid",
 "crypto-common",
 "subtle",
]

[[package]]
name = "directories-next"
version = "2.0.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "339ee130d97a610ea5a5872d2bbb130fdf68884ff09d3028b81bec8a1ac23bbc"
dependencies = [
 "cfg-if",
 "dirs-sys-next",
]

[[package]]
name = "dirs-next"
version = "2.0.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "b98cf8ebf19c3d1b223e151f99a4f9f0690dca41414773390fc824184ac833e1"
dependencies = [
 "cfg-if",
 "dirs-sys-next",
]

[[package]]
name = "dirs-sys-next"
version = "0.1.2"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "4ebda144c4fe02d1f7ea1a7d9641b6fc6b580adcfa024ae48797ecdeb6825b4d"
dependencies = [
 "libc",
 "redox_users",
 "winapi",
]

[[package]]
name = "downcast"
version = "0.11.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "1435fa1053d8b2fbbe9be7e97eca7f33d37b28409959813daefc1446a14247f1"

[[package]]
name = "dunce"
version = "1.0.5"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "92773504d58c093f6de2459af4af33faa518c13451eb8f2b5698ed3d36e7c813"

[[package]]
name = "dyn-clone"
version = "1.0.17"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "0d6ef0072f8a535281e4876be788938b528e9a1d43900b82c2569af7da799125"

[[package]]
name = "ecdsa"
version = "0.14.8"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "413301934810f597c1d19ca71c8710e99a3f1ba28a0d2ebc01551a2daeea3c5c"
dependencies = [
 "der 0.6.1",
 "elliptic-curve 0.12.3",
 "rfc6979 0.3.1",
 "signature 1.6.4",
]

[[package]]
name = "ecdsa"
version = "0.16.9"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "ee27f32b5c5292967d2d4a9d7f1e0b0aed2c15daded5a60300e4abb9d8020bca"
dependencies = [
 "der 0.7.9",
 "digest 0.10.7",
 "elliptic-curve 0.13.8",
 "rfc6979 0.4.0",
 "signature 2.2.0",
 "spki 0.7.3",
]

[[package]]
name = "ed25519"
version = "2.2.3"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "115531babc129696a58c64a4fef0a8bf9e9698629fb97e9e40767d235cfbcd53"
dependencies = [
 "pkcs8 0.10.2",
 "signature 2.2.0",
]

[[package]]
name = "ed25519-consensus"
version = "2.1.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "3c8465edc8ee7436ffea81d21a019b16676ee3db267aa8d5a8d729581ecf998b"
dependencies = [
 "curve25519-dalek-ng",
 "hex",
 "rand_core",
 "serde",
 "sha2 0.9.9",
 "thiserror",
 "zeroize",
]

[[package]]
name = "ed25519-dalek"
version = "2.1.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "4a3daa8e81a3963a60642bcc1f90a670680bd4a77535faa384e9d1c79d620871"
dependencies = [
 "curve25519-dalek",
 "ed25519",
 "merlin",
 "rand_core",
 "serde",
 "sha2 0.10.8",
 "signature 2.2.0",
 "subtle",
 "zeroize",
]

[[package]]
name = "either"
version = "1.13.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "60b1af1c220855b6ceac025d3f6ecdd2b7c4894bfe9cd9bda4fbb4bc7c0d4cf0"

[[package]]
name = "elliptic-curve"
version = "0.12.3"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "e7bb888ab5300a19b8e5bceef25ac745ad065f3c9f7efc6de1b91958110891d3"
dependencies = [
 "base16ct 0.1.1",
 "crypto-bigint 0.4.9",
 "der 0.6.1",
 "digest 0.10.7",
 "ff 0.12.1",
 "generic-array",
 "group 0.12.1",
 "pem-rfc7468 0.6.0",
 "pkcs8 0.9.0",
 "rand_core",
 "sec1 0.3.0",
 "subtle",
 "zeroize",
]

[[package]]
name = "elliptic-curve"
version = "0.13.8"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "b5e6043086bf7973472e0c7dff2142ea0b680d30e18d9cc40f267efbf222bd47"
dependencies = [
 "base16ct 0.2.0",
 "crypto-bigint 0.5.5",
 "digest 0.10.7",
 "ff 0.13.0",
 "generic-array",
 "group 0.13.0",
 "pem-rfc7468 0.7.0",
 "pkcs8 0.10.2",
 "rand_core",
 "sec1 0.7.3",
 "subtle",
 "zeroize",
]

[[package]]
name = "encode_unicode"
version = "0.3.6"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "a357d28ed41a50f9c765dbfe56cbc04a64e53e5fc58ba79fbc34c10ef3df831f"

[[package]]
name = "encoding_rs"
version = "0.8.34"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "b45de904aa0b010bce2ab45264d0631681847fa7b6f2eaa7dab7619943bc4f59"
dependencies = [
 "cfg-if",
]

[[package]]
name = "enumflags2"
version = "0.6.4"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "83c8d82922337cd23a15f88b70d8e4ef5f11da38dd7cdb55e84dd5de99695da0"
dependencies = [
 "enumflags2_derive",
 "serde",
]

[[package]]
name = "enumflags2_derive"
version = "0.6.4"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "946ee94e3dbf58fdd324f9ce245c7b238d46a66f00e86a020b71996349e46cce"
dependencies = [
 "proc-macro2",
 "quote",
 "syn 1.0.109",
]

[[package]]
name = "equivalent"
version = "1.0.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "5443807d6dff69373d433ab9ef5378ad8df50ca6298caf15de6e52e24aaf54d5"

[[package]]
name = "erased-serde"
version = "0.3.31"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "6c138974f9d5e7fe373eb04df7cae98833802ae4b11c24ac7039a21d5af4b26c"
dependencies = [
 "serde",
]

[[package]]
name = "errno"
version = "0.3.9"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "534c5cf6194dfab3db3242765c03bbe257cf92f22b38f6bc0c58d59108a820ba"
dependencies = [
 "libc",
 "windows-sys 0.52.0",
]

[[package]]
name = "event-listener"
version = "2.5.3"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "0206175f82b8d6bf6652ff7d71a1e27fd2e4efde587fd368662814d6ec1d9ce0"

[[package]]
name = "event-listener"
version = "5.3.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "6032be9bd27023a771701cc49f9f053c751055f71efb2e0ae5c15809093675ba"
dependencies = [
 "concurrent-queue",
 "parking",
 "pin-project-lite",
]

[[package]]
name = "event-listener-strategy"
version = "0.5.2"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "0f214dc438f977e6d4e3500aaa277f5ad94ca83fbbd9b1a15713ce2344ccc5a1"
dependencies = [
 "event-listener 5.3.1",
 "pin-project-lite",
]

[[package]]
name = "fallible-iterator"
version = "0.2.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "4443176a9f2c162692bd3d352d745ef9413eec5782a80d8fd6f8a1ac692a07f7"

[[package]]
name = "fastrand"
version = "1.9.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "e51093e27b0797c359783294ca4f0a911c270184cb10f85783b118614a1501be"
dependencies = [
 "instant",
]

[[package]]
name = "fastrand"
version = "2.1.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "e8c02a5121d4ea3eb16a80748c74f5549a5665e4c21333c6098f283870fbdea6"

[[package]]
name = "ff"
version = "0.12.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "d013fc25338cc558c5c2cfbad646908fb23591e2404481826742b651c9af7160"
dependencies = [
 "rand_core",
 "subtle",
]

[[package]]
name = "ff"
version = "0.13.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "ded41244b729663b1e574f1b4fb731469f69f79c17667b5d776b16cda0479449"
dependencies = [
 "rand_core",
 "subtle",
]

[[package]]
name = "fiat-crypto"
version = "0.2.9"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "28dea519a9695b9977216879a3ebfddf92f1c08c05d984f8996aecd6ecdc811d"

[[package]]
name = "filetime"
version = "0.2.25"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "35c0522e981e68cbfa8c3f978441a5f34b30b96e146b33cd3359176b50fe8586"
dependencies = [
 "cfg-if",
 "libc",
 "libredox",
 "windows-sys 0.59.0",
]

[[package]]
name = "fixedbitset"
version = "0.4.2"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "0ce7134b9999ecaf8bcd65542e436736ef32ddca1b3e06094cb6ec5755203b80"

[[package]]
name = "flate2"
version = "1.0.33"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "324a1be68054ef05ad64b861cc9eaf1d623d2d8cb25b4bf2cb9cdd902b4bf253"
dependencies = [
 "crc32fast",
 "libz-ng-sys",
 "miniz_oxide",
]

[[package]]
name = "fn-error-context"
version = "0.2.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "2cd66269887534af4b0c3e3337404591daa8dc8b9b2b3db71f9523beb4bafb41"
dependencies = [
 "proc-macro2",
 "quote",
 "syn 2.0.77",
]

[[package]]
name = "fnv"
version = "1.0.7"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "3f9eec918d3f24069decb9af1554cad7c880e2da24a9afd88aca000531ab82c1"

[[package]]
name = "foreign-types"
version = "0.3.2"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "f6f339eb8adc052cd2ca78910fda869aefa38d22d5cb648e6485e4d3fc06f3b1"
dependencies = [
 "foreign-types-shared",
]

[[package]]
name = "foreign-types-shared"
version = "0.1.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "00b0228411908ca8685dba7fc2cdd70ec9990a6e753e89b6ac91a84c40fbaf4b"

[[package]]
name = "form_urlencoded"
version = "1.2.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "e13624c2627564efccf4934284bdd98cbaa14e79b0b5a141218e507b3a823456"
dependencies = [
 "percent-encoding",
]

[[package]]
name = "fragile"
version = "2.0.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "6c2141d6d6c8512188a7891b4b01590a45f6dac67afb4f255c4124dbb86d4eaa"

[[package]]
name = "funty"
version = "2.0.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "e6d5a32815ae3f33302d95fdcb2ce17862f8c65363dcfd29360480ba1001fc9c"

[[package]]
name = "futures"
version = "0.3.30"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "645c6916888f6cb6350d2550b80fb63e734897a8498abe35cfb732b6487804b0"
dependencies = [
 "futures-channel",
 "futures-core",
 "futures-executor",
 "futures-io",
 "futures-sink",
 "futures-task",
 "futures-util",
]

[[package]]
name = "futures-channel"
version = "0.3.30"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "eac8f7d7865dcb88bd4373ab671c8cf4508703796caa2b1985a9ca867b3fcb78"
dependencies = [
 "futures-core",
 "futures-sink",
]

[[package]]
name = "futures-core"
version = "0.3.30"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "dfc6580bb841c5a68e9ef15c77ccc837b40a7504914d52e47b8b0e9bbda25a1d"

[[package]]
name = "futures-executor"
version = "0.3.30"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "a576fc72ae164fca6b9db127eaa9a9dda0d61316034f33a0a0d4eda41f02b01d"
dependencies = [
 "futures-core",
 "futures-task",
 "futures-util",
]

[[package]]
name = "futures-io"
version = "0.3.30"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "a44623e20b9681a318efdd71c299b6b222ed6f231972bfe2f224ebad6311f0c1"

[[package]]
name = "futures-lite"
version = "1.13.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "49a9d51ce47660b1e808d3c990b4709f2f415d928835a17dfd16991515c46bce"
dependencies = [
 "fastrand 1.9.0",
 "futures-core",
 "futures-io",
 "memchr",
 "parking",
 "pin-project-lite",
 "waker-fn",
]

[[package]]
name = "futures-macro"
version = "0.3.30"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "87750cf4b7a4c0625b1529e4c543c2182106e4dedc60a2a6455e00d212c489ac"
dependencies = [
 "proc-macro2",
 "quote",
 "syn 2.0.77",
]

[[package]]
name = "futures-sink"
version = "0.3.30"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "9fb8e00e87438d937621c1c6269e53f536c14d3fbd6a042bb24879e57d474fb5"

[[package]]
name = "futures-task"
version = "0.3.30"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "38d84fa142264698cdce1a9f9172cf383a0c82de1bddcf3092901442c4097004"

[[package]]
name = "futures-util"
version = "0.3.30"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "3d6401deb83407ab3da39eba7e33987a73c3df0c82b4bb5813ee871c19c41d48"
dependencies = [
 "futures-channel",
 "futures-core",
 "futures-io",
 "futures-macro",
 "futures-sink",
 "futures-task",
 "memchr",
 "pin-project-lite",
 "pin-utils",
 "slab",
]

[[package]]
name = "generic-array"
version = "0.14.7"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "85649ca51fd72272d7821adaf274ad91c288277713d9c18820d8499a7ff69e9a"
dependencies = [
 "typenum",
 "version_check",
 "zeroize",
]

[[package]]
name = "getrandom"
version = "0.2.15"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "c4567c8db10ae91089c99af84c68c38da3ec2f087c3f82960bcdbf3656b6f4d7"
dependencies = [
 "cfg-if",
 "libc",
 "wasi",
]

[[package]]
name = "ghash"
version = "0.5.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "f0d8a4362ccb29cb0b265253fb0a2728f592895ee6854fd9bc13f2ffda266ff1"
dependencies = [
 "opaque-debug",
 "polyval",
]

[[package]]
name = "gimli"
version = "0.26.2"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "22030e2c5a68ec659fde1e949a745124b48e6fa8b045b7ed5bd1fe4ccc5c4e5d"
dependencies = [
 "fallible-iterator",
 "indexmap 1.9.3",
 "stable_deref_trait",
]

[[package]]
name = "gimli"
version = "0.31.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "32085ea23f3234fc7846555e85283ba4de91e21016dc0455a16286d87a292d64"

[[package]]
name = "glob"
version = "0.3.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "d2fabcfbdc87f4758337ca535fb41a6d701b65693ce38287d856d1674551ec9b"

[[package]]
name = "group"
version = "0.12.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "5dfbfb3a6cfbd390d5c9564ab283a0349b9b9fcd46a706c1eb10e0db70bfbac7"
dependencies = [
 "ff 0.12.1",
 "rand_core",
 "subtle",
]

[[package]]
name = "group"
version = "0.13.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "f0f9ef7462f7c099f518d754361858f86d8a07af53ba9af0fe635bbccb151a63"
dependencies = [
 "ff 0.13.0",
 "rand_core",
 "subtle",
]

[[package]]
name = "h2"
version = "0.3.26"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "81fe527a889e1532da5c525686d96d4c2e74cdd345badf8dfef9f6b39dd5f5e8"
dependencies = [
 "bytes",
 "fnv",
 "futures-core",
 "futures-sink",
 "futures-util",
 "http 0.2.12",
 "indexmap 2.5.0",
 "slab",
 "tokio",
 "tokio-util",
 "tracing",
]

[[package]]
name = "h2"
version = "0.4.6"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "524e8ac6999421f49a846c2d4411f337e53497d8ec55d67753beffa43c5d9205"
dependencies = [
 "atomic-waker",
 "bytes",
 "fnv",
 "futures-core",
 "futures-sink",
 "http 1.1.0",
 "indexmap 2.5.0",
 "slab",
 "tokio",
 "tokio-util",
 "tracing",
]

[[package]]
name = "half"
version = "1.8.3"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "1b43ede17f21864e81be2fa654110bf1e793774238d86ef8555c37e6519c0403"

[[package]]
name = "half"
version = "2.4.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "6dd08c532ae367adf81c312a4580bc67f1d0fe8bc9c460520283f4c0ff277888"
dependencies = [
 "cfg-if",
 "crunchy",
]

[[package]]
name = "handlebars"
version = "4.5.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "faa67bab9ff362228eb3d00bd024a4965d8231bbb7921167f0cfa66c6626b225"
dependencies = [
 "log",
 "pest",
 "pest_derive",
 "serde",
 "serde_json",
 "thiserror",
]

[[package]]
name = "hashbrown"
version = "0.12.3"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "8a9ee70c43aaf417c914396645a0fa852624801b24ebb7ae78fe8272889ac888"
dependencies = [
 "ahash 0.7.8",
]

[[package]]
name = "hashbrown"
version = "0.14.5"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "e5274423e17b7c9fc20b6e7e208532f9b19825d82dfd615708b70edd83df41f1"
dependencies = [
 "ahash 0.8.11",
 "allocator-api2",
 "serde",
]

[[package]]
name = "heck"
version = "0.3.3"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "6d621efb26863f0e9924c6ac577e8275e5e6b77455db64ffa6c65c904e9e132c"
dependencies = [
 "unicode-segmentation",
]

[[package]]
name = "heck"
version = "0.4.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "95505c38b4572b2d910cecb0281560f54b440a19336cbbcb27bf6ce6adc6f5a8"

[[package]]
name = "heck"
version = "0.5.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "2304e00983f87ffb38b55b444b5e3b60a884b5d30c0fca7d82fe33449bbe55ea"

[[package]]
name = "hermit-abi"
version = "0.1.19"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "62b467343b94ba476dcb2500d242dadbb39557df889310ac77c5d99100aaac33"
dependencies = [
 "libc",
]

[[package]]
name = "hermit-abi"
version = "0.3.9"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "d231dfb89cfffdbc30e7fc41579ed6066ad03abda9e567ccafae602b97ec5024"

[[package]]
name = "hermit-abi"
version = "0.4.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "fbf6a919d6cf397374f7dfeeea91d974c7c0a7221d0d0f4f20d859d329e53fcc"

[[package]]
name = "hex"
version = "0.4.3"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "7f24254aa9a54b5c858eaee2f5bccdb46aaf0e486a595ed5fd8f86ba55232a70"
dependencies = [
 "serde",
]

[[package]]
name = "hkdf"
version = "0.11.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "01706d578d5c281058480e673ae4086a9f4710d8df1ad80a5b03e39ece5f886b"
dependencies = [
 "digest 0.9.0",
 "hmac 0.11.0",
]

[[package]]
name = "hkdf"
version = "0.12.4"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "7b5f8eb2ad728638ea2c7d47a21db23b7b58a72ed6a38256b8a1849f15fbbdf7"
dependencies = [
 "hmac 0.12.1",
]

[[package]]
name = "hmac"
version = "0.11.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "2a2a2320eb7ec0ebe8da8f744d7812d9fc4cb4d09344ac01898dbcb6a20ae69b"
dependencies = [
 "crypto-mac",
 "digest 0.9.0",
]

[[package]]
name = "hmac"
version = "0.12.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "6c49c37c09c17a53d937dfbb742eb3a961d65a994e6bcdcf37e7399d0cc8ab5e"
dependencies = [
 "digest 0.10.7",
]

[[package]]
name = "http"
version = "0.2.12"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "601cbb57e577e2f5ef5be8e7b83f0f63994f25aa94d673e54a92d5c516d101f1"
dependencies = [
 "bytes",
 "fnv",
 "itoa",
]

[[package]]
name = "http"
version = "1.1.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "21b9ddb458710bc376481b842f5da65cdf31522de232c1ca8146abce2a358258"
dependencies = [
 "bytes",
 "fnv",
 "itoa",
]

[[package]]
name = "http-body"
version = "0.4.6"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "7ceab25649e9960c0311ea418d17bee82c0dcec1bd053b5f9a66e265a693bed2"
dependencies = [
 "bytes",
 "http 0.2.12",
 "pin-project-lite",
]

[[package]]
name = "http-body"
version = "1.0.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "1efedce1fb8e6913f23e0c92de8e62cd5b772a67e7b3946df930a62566c93184"
dependencies = [
 "bytes",
 "http 1.1.0",
]

[[package]]
name = "http-body-to-bytes"
version = "0.2.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "17a08236c6f51c2ee95d840f45acf8fa9e339390e00b4ef640857b2f2a534d70"
dependencies = [
 "bytes",
 "http-body 1.0.1",
 "http-body-util",
]

[[package]]
name = "http-body-util"
version = "0.1.2"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "793429d76616a256bcb62c2a2ec2bed781c8307e797e2598c50010f2bee2544f"
dependencies = [
 "bytes",
 "futures-util",
 "http 1.1.0",
 "http-body 1.0.1",
 "pin-project-lite",
]

[[package]]
name = "httparse"
version = "1.9.4"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "0fcc0b4a115bf80b728eb8ea024ad5bd707b615bfed49e0665b6e0f86fd082d9"

[[package]]
name = "httpdate"
version = "1.0.3"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "df3b46402a9d5adb4c86a0cf463f42e19994e3ee891101b1841f30a545cb49a9"

[[package]]
name = "humantime"
version = "2.1.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "9a3a5bfb195931eeb336b2a7b4d761daec841b97f947d34394601737a7bba5e4"

[[package]]
name = "humantime-serde"
version = "1.1.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "57a3db5ea5923d99402c94e9feb261dc5ee9b4efa158b0315f788cf549cc200c"
dependencies = [
 "humantime",
 "serde",
]

[[package]]
name = "hyper"
version = "0.14.30"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "a152ddd61dfaec7273fe8419ab357f33aee0d914c5f4efbf0d96fa749eea5ec9"
dependencies = [
 "bytes",
 "futures-channel",
 "futures-core",
 "futures-util",
 "h2 0.3.26",
 "http 0.2.12",
 "http-body 0.4.6",
 "httparse",
 "httpdate",
 "itoa",
 "pin-project-lite",
 "socket2 0.5.7",
 "tokio",
 "tower-service",
 "tracing",
 "want",
]

[[package]]
name = "hyper"
version = "1.4.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "50dfd22e0e76d0f662d429a5f80fcaf3855009297eab6a0a9f8543834744ba05"
dependencies = [
 "bytes",
 "futures-channel",
 "futures-util",
 "h2 0.4.6",
 "http 1.1.0",
 "http-body 1.0.1",
 "httparse",
 "itoa",
 "pin-project-lite",
 "smallvec",
 "tokio",
 "want",
]

[[package]]
name = "hyper-rustls"
version = "0.23.2"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "1788965e61b367cd03a62950836d5cd41560c3577d90e40e0819373194d1661c"
dependencies = [
 "http 0.2.12",
 "hyper 0.14.30",
 "log",
 "rustls 0.20.9",
 "rustls-native-certs 0.6.3",
 "tokio",
 "tokio-rustls 0.23.4",
 "webpki-roots 0.22.6",
]

[[package]]
name = "hyper-rustls"
version = "0.24.2"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "ec3efd23720e2049821a693cbc7e65ea87c72f1c58ff2f9522ff332b1491e590"
dependencies = [
 "futures-util",
 "http 0.2.12",
 "hyper 0.14.30",
 "rustls 0.21.12",
 "tokio",
 "tokio-rustls 0.24.1",
]

[[package]]
name = "hyper-rustls"
version = "0.27.3"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "08afdbb5c31130e3034af566421053ab03787c640246a446327f550d11bcb333"
dependencies = [
 "futures-util",
 "http 1.1.0",
 "hyper 1.4.1",
 "hyper-util",
 "rustls 0.23.13",
 "rustls-native-certs 0.8.0",
 "rustls-pki-types",
 "tokio",
 "tokio-rustls 0.26.0",
 "tower-service",
 "webpki-roots 0.26.5",
]

[[package]]
name = "hyper-tls"
version = "0.5.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "d6183ddfa99b85da61a140bea0efc93fdf56ceaa041b37d553518030827f9905"
dependencies = [
 "bytes",
 "hyper 0.14.30",
 "native-tls",
 "tokio",
 "tokio-native-tls",
]

[[package]]
name = "hyper-util"
version = "0.1.8"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "da62f120a8a37763efb0cf8fdf264b884c7b8b9ac8660b900c8661030c00e6ba"
dependencies = [
 "bytes",
 "futures-channel",
 "futures-util",
 "http 1.1.0",
 "http-body 1.0.1",
 "hyper 1.4.1",
 "pin-project-lite",
 "socket2 0.5.7",
 "tokio",
 "tower",
 "tower-service",
 "tracing",
]

[[package]]
name = "iana-time-zone"
version = "0.1.60"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "e7ffbb5a1b541ea2561f8c41c087286cc091e21e556a4f09a8f6cbf17b69b141"
dependencies = [
 "android_system_properties",
 "core-foundation-sys",
 "iana-time-zone-haiku",
 "js-sys",
 "wasm-bindgen",
 "windows-core",
]

[[package]]
name = "iana-time-zone-haiku"
version = "0.1.2"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "f31827a206f56af32e590ba56d5d2d085f558508192593743f16b2306495269f"
dependencies = [
 "cc",
]

[[package]]
name = "ic-agent"
version = "0.37.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "3fd3fdf5e5c4f4a9fe5ca612f0febd22dcb161d2f2b75b0142326732be5e4978"
dependencies = [
 "async-lock 3.4.0",
 "backoff",
 "cached",
 "candid",
 "ed25519-consensus",
 "futures-util",
 "hex",
 "http 1.1.0",
 "http-body 1.0.1",
 "http-body-to-bytes",
 "http-body-util",
 "hyper 1.4.1",
 "hyper-rustls 0.27.3",
 "hyper-util",
 "ic-certification",
 "ic-transport-types 0.37.1 (registry+https://github.com/rust-lang/crates.io-index)",
 "ic-verify-bls-signature",
 "k256 0.13.3",
 "leb128",
 "p256",
 "pem 3.0.4",
 "pkcs8 0.10.2",
 "rand",
 "rangemap",
 "reqwest 0.12.7",
 "ring 0.17.8",
 "rustls-webpki 0.102.8",
 "sec1 0.7.3",
 "serde",
 "serde_bytes",
 "serde_cbor",
 "serde_repr",
 "sha2 0.10.8",
 "simple_asn1",
 "thiserror",
 "time",
 "tokio",
 "tower",
 "url",
]

[[package]]
name = "ic-agent"
version = "0.37.1"
source = "git+https://github.com/dfinity/agent-rs?rev=6e11a350112f9b907c4d590d8217f340e153d898#6e11a350112f9b907c4d590d8217f340e153d898"
dependencies = [
 "async-lock 3.4.0",
 "backoff",
 "cached",
 "candid",
 "ed25519-consensus",
 "futures-util",
 "hex",
 "http 1.1.0",
 "http-body 1.0.1",
 "ic-certification",
 "ic-transport-types 0.37.1 (git+https://github.com/dfinity/agent-rs?rev=6e11a350112f9b907c4d590d8217f340e153d898)",
 "ic-verify-bls-signature",
 "k256 0.13.3",
 "leb128",
 "p256",
 "pem 3.0.4",
 "pkcs8 0.10.2",
 "rand",
 "rangemap",
 "reqwest 0.12.7",
 "ring 0.17.8",
 "rustls-webpki 0.102.8",
 "sec1 0.7.3",
 "serde",
 "serde_bytes",
 "serde_cbor",
 "serde_repr",
 "sha2 0.10.8",
 "simple_asn1",
 "thiserror",
 "time",
 "tokio",
 "url",
]

[[package]]
name = "ic-base-types"
version = "0.9.0"
source = "git+https://github.com/dfinity/ic?rev=f7e561c00a2745f946372f5166fd7968fa664f53#f7e561c00a2745f946372f5166fd7968fa664f53"
dependencies = [
 "byte-unit",
 "bytes",
 "candid",
 "comparable",
 "hex",
 "ic-crypto-sha2",
 "ic-protobuf",
 "phantom_newtype",
 "prost",
 "serde",
 "strum",
 "strum_macros",
]

[[package]]
name = "ic-btc-interface"
version = "0.2.2"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "b0152e14e697b0e988dbfdcb3f7e352d1c76a65b7d2d75c5d76bad22c3aca10d"
dependencies = [
 "candid",
 "serde",
 "serde_bytes",
]

[[package]]
name = "ic-btc-replica-types"
version = "0.9.0"
source = "git+https://github.com/dfinity/ic?rev=f7e561c00a2745f946372f5166fd7968fa664f53#f7e561c00a2745f946372f5166fd7968fa664f53"
dependencies = [
 "candid",
 "ic-btc-interface",
 "ic-error-types",
 "ic-protobuf",
 "serde",
 "serde_bytes",
]

[[package]]
name = "ic-canister-client-sender"
version = "0.9.0"
source = "git+https://github.com/dfinity/ic?rev=f7e561c00a2745f946372f5166fd7968fa664f53#f7e561c00a2745f946372f5166fd7968fa664f53"
dependencies = [
 "ic-base-types",
 "ic-crypto-ed25519",
 "ic-crypto-secp256k1",
 "ic-types",
 "rand",
 "rand_chacha",
]

[[package]]
name = "ic-canister-log"
version = "0.2.0"
source = "git+https://github.com/dfinity/ic?rev=f7e561c00a2745f946372f5166fd7968fa664f53#f7e561c00a2745f946372f5166fd7968fa664f53"
dependencies = [
 "serde",
]

[[package]]
name = "ic-canister-profiler"
version = "0.9.0"
source = "git+https://github.com/dfinity/ic?rev=f7e561c00a2745f946372f5166fd7968fa664f53#f7e561c00a2745f946372f5166fd7968fa664f53"
dependencies = [
 "ic-metrics-encoder",
 "ic0 0.18.11",
]

[[package]]
name = "ic-canisters-http-types"
version = "0.9.0"
source = "git+https://github.com/dfinity/ic?rev=f7e561c00a2745f946372f5166fd7968fa664f53#f7e561c00a2745f946372f5166fd7968fa664f53"
dependencies = [
 "candid",
 "dfn_candid",
 "serde",
 "serde_bytes",
]

[[package]]
name = "ic-cdk"
version = "0.13.5"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "3b1da6a25b045f9da3c9459c0cb2b0700ac368ee16382975a17185a23b9c18ab"
dependencies = [
 "candid",
 "ic-cdk-macros 0.13.2",
 "ic0 0.21.1",
 "serde",
 "serde_bytes",
]

[[package]]
name = "ic-cdk-macros"
version = "0.9.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "2fde5ca6ef1e69825c68916ff1bf7256b8f7ed69ac5ea3f1756f6e57f1503e27"
dependencies = [
 "candid",
 "proc-macro2",
 "quote",
 "serde",
 "serde_tokenstream",
 "syn 1.0.109",
]

[[package]]
name = "ic-cdk-macros"
version = "0.13.2"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "a45800053d80a6df839a71aaea5797e723188c0b992618208ca3b941350c7355"
dependencies = [
 "candid",
 "proc-macro2",
 "quote",
 "serde",
 "serde_tokenstream",
 "syn 1.0.109",
]

[[package]]
name = "ic-cdk-timers"
version = "0.7.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "054727a3a1c486528b96349817d54290ff70df6addf417def456ea708a16f7fb"
dependencies = [
 "futures",
 "ic-cdk",
 "ic0 0.21.1",
 "serde",
 "serde_bytes",
 "slotmap",
]

[[package]]
name = "ic-certification"
version = "2.6.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "e64ee3d8b6e81b51f245716d3e0badb63c283c00f3c9fb5d5219afc30b5bf821"
dependencies = [
 "hex",
 "serde",
 "serde_bytes",
 "sha2 0.10.8",
]

[[package]]
name = "ic-certified-map"
version = "0.3.4"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "6adc65afeffc619a7cd19553c66c79820908c12f42191af90cfb39e2e93c4431"
dependencies = [
 "serde",
 "serde_bytes",
 "sha2 0.10.8",
]

[[package]]
name = "ic-config"
version = "0.9.0"
source = "git+https://github.com/dfinity/ic?rev=f7e561c00a2745f946372f5166fd7968fa664f53#f7e561c00a2745f946372f5166fd7968fa664f53"
dependencies = [
 "ic-base-types",
 "ic-protobuf",
 "ic-registry-subnet-type",
 "ic-sys",
 "ic-types",
 "json5",
 "serde",
 "tempfile",
]

[[package]]
name = "ic-crypto-ed25519"
version = "0.9.0"
source = "git+https://github.com/dfinity/ic?rev=f7e561c00a2745f946372f5166fd7968fa664f53#f7e561c00a2745f946372f5166fd7968fa664f53"
dependencies = [
 "curve25519-dalek",
 "ed25519-dalek",
 "hkdf 0.12.4",
 "pem 1.1.1",
 "rand",
 "thiserror",
 "zeroize",
]

[[package]]
name = "ic-crypto-getrandom-for-wasm"
version = "0.9.0"
source = "git+https://github.com/dfinity/ic?rev=f7e561c00a2745f946372f5166fd7968fa664f53#f7e561c00a2745f946372f5166fd7968fa664f53"
dependencies = [
 "getrandom",
]

[[package]]
name = "ic-crypto-internal-sha2"
version = "0.9.0"
source = "git+https://github.com/dfinity/ic?rev=f7e561c00a2745f946372f5166fd7968fa664f53#f7e561c00a2745f946372f5166fd7968fa664f53"
dependencies = [
 "sha2 0.10.8",
]

[[package]]
name = "ic-crypto-internal-types"
version = "0.9.0"
source = "git+https://github.com/dfinity/ic?rev=f7e561c00a2745f946372f5166fd7968fa664f53#f7e561c00a2745f946372f5166fd7968fa664f53"
dependencies = [
 "arrayvec 0.7.6",
 "hex",
 "ic-protobuf",
 "phantom_newtype",
 "serde",
 "serde_cbor",
 "strum",
 "strum_macros",
 "thiserror",
 "zeroize",
]

[[package]]
name = "ic-crypto-secp256k1"
version = "0.9.0"
source = "git+https://github.com/dfinity/ic?rev=f7e561c00a2745f946372f5166fd7968fa664f53#f7e561c00a2745f946372f5166fd7968fa664f53"
dependencies = [
 "hmac 0.12.1",
 "k256 0.13.3",
 "lazy_static",
 "num-bigint 0.4.6",
 "pem 1.1.1",
 "rand",
 "rand_chacha",
 "simple_asn1",
 "zeroize",
]

[[package]]
name = "ic-crypto-sha2"
version = "0.9.0"
source = "git+https://github.com/dfinity/ic?rev=f7e561c00a2745f946372f5166fd7968fa664f53#f7e561c00a2745f946372f5166fd7968fa664f53"
dependencies = [
 "ic-crypto-internal-sha2",
]

[[package]]
name = "ic-crypto-tree-hash"
version = "0.9.0"
source = "git+https://github.com/dfinity/ic?rev=f7e561c00a2745f946372f5166fd7968fa664f53#f7e561c00a2745f946372f5166fd7968fa664f53"
dependencies = [
 "ic-crypto-internal-types",
 "ic-crypto-sha2",
 "ic-protobuf",
 "serde",
 "serde_bytes",
 "thiserror",
]

[[package]]
name = "ic-error-types"
version = "0.9.0"
source = "git+https://github.com/dfinity/ic?rev=f7e561c00a2745f946372f5166fd7968fa664f53#f7e561c00a2745f946372f5166fd7968fa664f53"
dependencies = [
 "ic-protobuf",
 "ic-utils 0.9.0",
 "serde",
 "strum",
 "strum_macros",
]

[[package]]
name = "ic-http-utils"
version = "0.9.0"
source = "git+https://github.com/dfinity/ic?rev=f7e561c00a2745f946372f5166fd7968fa664f53#f7e561c00a2745f946372f5166fd7968fa664f53"
dependencies = [
 "flate2",
 "hex",
 "http 1.1.0",
 "ic-crypto-sha2",
 "ic-logger",
 "reqwest 0.12.7",
 "slog",
 "tar",
 "tokio",
 "zstd",
]

[[package]]
name = "ic-icp-index"
version = "0.9.0"
source = "git+https://github.com/dfinity/ic?rev=f7e561c00a2745f946372f5166fd7968fa664f53#f7e561c00a2745f946372f5166fd7968fa664f53"
dependencies = [
 "candid",
 "ciborium",
 "dfn_core",
 "ic-base-types",
 "ic-canister-log",
 "ic-canisters-http-types",
 "ic-cdk",
 "ic-cdk-macros 0.9.0",
 "ic-cdk-timers",
 "ic-icrc1-index-ng",
 "ic-ledger-canister-core",
 "ic-ledger-core",
 "ic-metrics-encoder",
 "ic-stable-structures",
 "icp-ledger",
 "icrc-ledger-types",
 "num-traits",
 "scopeguard",
 "serde",
 "serde_bytes",
 "serde_json",
]

[[package]]
name = "ic-icrc1"
version = "0.9.0"
source = "git+https://github.com/dfinity/ic?rev=f7e561c00a2745f946372f5166fd7968fa664f53#f7e561c00a2745f946372f5166fd7968fa664f53"
dependencies = [
 "candid",
 "ciborium",
 "hex",
 "ic-base-types",
 "ic-crypto-sha2",
 "ic-icrc1-tokens-u64",
 "ic-ledger-canister-core",
 "ic-ledger-core",
 "ic-ledger-hash-of",
 "icrc-ledger-types",
 "num-bigint 0.4.6",
 "num-traits",
 "serde",
 "serde_bytes",
 "tempfile",
 "thiserror",
]

[[package]]
name = "ic-icrc1-index-ng"
version = "0.9.0"
source = "git+https://github.com/dfinity/ic?rev=f7e561c00a2745f946372f5166fd7968fa664f53#f7e561c00a2745f946372f5166fd7968fa664f53"
dependencies = [
 "candid",
 "ciborium",
 "ic-base-types",
 "ic-canister-log",
 "ic-canister-profiler",
 "ic-canisters-http-types",
 "ic-cdk",
 "ic-cdk-macros 0.9.0",
 "ic-cdk-timers",
 "ic-crypto-sha2",
 "ic-icrc1",
 "ic-icrc1-tokens-u64",
 "ic-ledger-canister-core",
 "ic-ledger-core",
 "ic-metrics-encoder",
 "ic-stable-structures",
 "icrc-ledger-types",
 "num-traits",
 "scopeguard",
 "serde",
 "serde_json",
]

[[package]]
name = "ic-icrc1-ledger"
version = "0.9.0"
source = "git+https://github.com/dfinity/ic?rev=f7e561c00a2745f946372f5166fd7968fa664f53#f7e561c00a2745f946372f5166fd7968fa664f53"
dependencies = [
 "async-trait",
 "candid",
 "ciborium",
 "hex",
 "ic-base-types",
 "ic-canister-log",
 "ic-canisters-http-types",
 "ic-cdk",
 "ic-cdk-macros 0.9.0",
 "ic-crypto-tree-hash",
 "ic-icrc1",
 "ic-icrc1-tokens-u64",
 "ic-ledger-canister-core",
 "ic-ledger-core",
 "ic-ledger-hash-of",
 "ic-metrics-encoder",
 "ic-stable-structures",
 "icrc-ledger-client",
 "icrc-ledger-types",
 "num-traits",
 "serde",
 "serde_bytes",
]

[[package]]
name = "ic-icrc1-tokens-u64"
version = "0.1.0"
source = "git+https://github.com/dfinity/ic?rev=f7e561c00a2745f946372f5166fd7968fa664f53#f7e561c00a2745f946372f5166fd7968fa664f53"
dependencies = [
 "candid",
 "ic-ledger-core",
 "ic-stable-structures",
 "num-traits",
 "serde",
]

[[package]]
name = "ic-identity-hsm"
version = "0.37.1"
source = "git+https://github.com/dfinity/agent-rs?rev=6e11a350112f9b907c4d590d8217f340e153d898#6e11a350112f9b907c4d590d8217f340e153d898"
dependencies = [
 "hex",
 "ic-agent 0.37.1 (git+https://github.com/dfinity/agent-rs?rev=6e11a350112f9b907c4d590d8217f340e153d898)",
 "pkcs11",
 "sha2 0.10.8",
 "simple_asn1",
 "thiserror",
]

[[package]]
name = "ic-ledger-canister-core"
version = "0.9.0"
source = "git+https://github.com/dfinity/ic?rev=f7e561c00a2745f946372f5166fd7968fa664f53#f7e561c00a2745f946372f5166fd7968fa664f53"
dependencies = [
 "async-trait",
 "candid",
 "ic-base-types",
 "ic-canister-log",
 "ic-ledger-core",
 "ic-ledger-hash-of",
 "ic-limits",
 "ic-management-canister-types",
 "ic-utils 0.9.0",
 "num-traits",
 "serde",
]

[[package]]
name = "ic-ledger-core"
version = "0.9.0"
source = "git+https://github.com/dfinity/ic?rev=f7e561c00a2745f946372f5166fd7968fa664f53#f7e561c00a2745f946372f5166fd7968fa664f53"
dependencies = [
 "candid",
 "ic-ledger-hash-of",
 "num-traits",
 "serde",
 "serde_bytes",
]

[[package]]
name = "ic-ledger-hash-of"
version = "0.1.0"
source = "git+https://github.com/dfinity/ic?rev=f7e561c00a2745f946372f5166fd7968fa664f53#f7e561c00a2745f946372f5166fd7968fa664f53"
dependencies = [
 "candid",
 "hex",
 "serde",
]

[[package]]
name = "ic-limits"
version = "0.9.0"
source = "git+https://github.com/dfinity/ic?rev=f7e561c00a2745f946372f5166fd7968fa664f53#f7e561c00a2745f946372f5166fd7968fa664f53"

[[package]]
name = "ic-logger"
version = "0.9.0"
source = "git+https://github.com/dfinity/ic?rev=f7e561c00a2745f946372f5166fd7968fa664f53#f7e561c00a2745f946372f5166fd7968fa664f53"
dependencies = [
 "chrono",
 "ic-config",
 "ic-protobuf",
 "ic-utils 0.9.0",
 "serde",
 "slog",
 "slog-async",
 "slog-json",
 "slog-scope",
 "slog-term",
]

[[package]]
name = "ic-management-canister-types"
version = "0.9.0"
source = "git+https://github.com/dfinity/ic?rev=f7e561c00a2745f946372f5166fd7968fa664f53#f7e561c00a2745f946372f5166fd7968fa664f53"
dependencies = [
 "candid",
 "ic-base-types",
 "ic-btc-interface",
 "ic-btc-replica-types",
 "ic-error-types",
 "ic-protobuf",
 "ic-utils 0.9.0",
 "num-traits",
 "serde",
 "serde_bytes",
 "serde_cbor",
 "strum",
 "strum_macros",
]

[[package]]
name = "ic-metrics-encoder"
version = "1.1.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "8b5c7628eac357aecda461130f8074468be5aa4d258a002032d82d817f79f1f8"

[[package]]
name = "ic-nervous-system-agent"
version = "0.0.1"
source = "git+https://github.com/dfinity/ic?rev=f7e561c00a2745f946372f5166fd7968fa664f53#f7e561c00a2745f946372f5166fd7968fa664f53"
dependencies = [
 "anyhow",
 "candid",
 "ic-agent 0.37.1 (registry+https://github.com/rust-lang/crates.io-index)",
 "ic-base-types",
 "ic-nervous-system-clients",
 "ic-nns-constants",
 "ic-sns-governance",
 "ic-sns-wasm",
 "serde",
 "tempfile",
 "thiserror",
 "tokio",
]

[[package]]
name = "ic-nervous-system-canisters"
version = "0.9.0"
source = "git+https://github.com/dfinity/ic?rev=f7e561c00a2745f946372f5166fd7968fa664f53#f7e561c00a2745f946372f5166fd7968fa664f53"
dependencies = [
 "async-trait",
 "candid",
 "dfn_core",
 "ic-base-types",
 "ic-ledger-core",
 "ic-nervous-system-common",
 "ic-nervous-system-runtime",
 "ic-nns-constants",
 "icp-ledger",
 "icrc-ledger-types",
]

[[package]]
name = "ic-nervous-system-clients"
version = "0.0.1"
source = "git+https://github.com/dfinity/ic?rev=f7e561c00a2745f946372f5166fd7968fa664f53#f7e561c00a2745f946372f5166fd7968fa664f53"
dependencies = [
 "async-trait",
 "candid",
 "dfn_candid",
 "dfn_core",
 "ic-base-types",
 "ic-error-types",
 "ic-ledger-core",
 "ic-management-canister-types",
 "ic-nervous-system-common",
 "ic-nervous-system-proxied-canister-calls-tracker",
 "ic-nervous-system-runtime",
 "ic-utils 0.9.0",
 "icrc-ledger-client",
 "icrc-ledger-types",
 "num-traits",
 "serde",
]

[[package]]
name = "ic-nervous-system-collections-union-multi-map"
version = "0.0.1"
source = "git+https://github.com/dfinity/ic?rev=f7e561c00a2745f946372f5166fd7968fa664f53#f7e561c00a2745f946372f5166fd7968fa664f53"

[[package]]
name = "ic-nervous-system-common"
version = "0.9.0"
source = "git+https://github.com/dfinity/ic?rev=f7e561c00a2745f946372f5166fd7968fa664f53#f7e561c00a2745f946372f5166fd7968fa664f53"
dependencies = [
 "async-trait",
 "base64 0.13.1",
 "build-info",
 "build-info-build",
 "by_address",
 "bytes",
 "dfn_core",
 "ic-base-types",
 "ic-canister-log",
 "ic-canisters-http-types",
 "ic-crypto-sha2",
 "ic-ledger-core",
 "ic-metrics-encoder",
 "ic-nervous-system-runtime",
 "ic-nns-constants",
 "ic-stable-structures",
 "icp-ledger",
 "icrc-ledger-types",
 "json5",
 "lazy_static",
 "maplit",
 "mockall",
 "num-traits",
 "priority-queue",
 "prost",
 "rust_decimal",
 "serde",
 "serde_json",
]

[[package]]
name = "ic-nervous-system-common-build-metadata"
version = "0.9.0"
source = "git+https://github.com/dfinity/ic?rev=f7e561c00a2745f946372f5166fd7968fa664f53#f7e561c00a2745f946372f5166fd7968fa664f53"

[[package]]
name = "ic-nervous-system-common-test-keys"
version = "0.9.0"
source = "git+https://github.com/dfinity/ic?rev=f7e561c00a2745f946372f5166fd7968fa664f53#f7e561c00a2745f946372f5166fd7968fa664f53"
dependencies = [
 "ic-base-types",
 "ic-canister-client-sender",
 "ic-types",
 "lazy_static",
 "rand",
 "rand_chacha",
]

[[package]]
name = "ic-nervous-system-common-validation"
version = "0.9.0"
source = "git+https://github.com/dfinity/ic?rev=f7e561c00a2745f946372f5166fd7968fa664f53#f7e561c00a2745f946372f5166fd7968fa664f53"

[[package]]
name = "ic-nervous-system-governance"
version = "0.0.1"
source = "git+https://github.com/dfinity/ic?rev=f7e561c00a2745f946372f5166fd7968fa664f53#f7e561c00a2745f946372f5166fd7968fa664f53"
dependencies = [
 "ic-base-types",
 "ic-stable-structures",
 "ic_principal",
 "maplit",
 "num-traits",
]

[[package]]
name = "ic-nervous-system-humanize"
version = "0.9.0"
source = "git+https://github.com/dfinity/ic?rev=f7e561c00a2745f946372f5166fd7968fa664f53#f7e561c00a2745f946372f5166fd7968fa664f53"
dependencies = [
 "humantime",
 "ic-nervous-system-proto",
 "lazy_static",
 "regex",
 "serde",
]

[[package]]
name = "ic-nervous-system-lock"
version = "0.0.1"
source = "git+https://github.com/dfinity/ic?rev=f7e561c00a2745f946372f5166fd7968fa664f53#f7e561c00a2745f946372f5166fd7968fa664f53"

[[package]]
name = "ic-nervous-system-proto"
version = "0.9.0"
source = "git+https://github.com/dfinity/ic?rev=f7e561c00a2745f946372f5166fd7968fa664f53#f7e561c00a2745f946372f5166fd7968fa664f53"
dependencies = [
 "candid",
 "comparable",
 "ic-base-types",
 "prost",
 "rust_decimal",
 "serde",
]

[[package]]
name = "ic-nervous-system-proxied-canister-calls-tracker"
version = "0.9.0"
source = "git+https://github.com/dfinity/ic?rev=f7e561c00a2745f946372f5166fd7968fa664f53#f7e561c00a2745f946372f5166fd7968fa664f53"
dependencies = [
 "ic-base-types",
]

[[package]]
name = "ic-nervous-system-root"
version = "0.9.0"
source = "git+https://github.com/dfinity/ic?rev=f7e561c00a2745f946372f5166fd7968fa664f53#f7e561c00a2745f946372f5166fd7968fa664f53"
dependencies = [
 "candid",
 "dfn_core",
 "ic-cdk",
 "ic-crypto-sha2",
 "ic-management-canister-types",
 "ic-nervous-system-clients",
 "ic-nervous-system-runtime",
 "serde",
 "serde_bytes",
]

[[package]]
name = "ic-nervous-system-runtime"
version = "0.9.0"
source = "git+https://github.com/dfinity/ic?rev=f7e561c00a2745f946372f5166fd7968fa664f53#f7e561c00a2745f946372f5166fd7968fa664f53"
dependencies = [
 "async-trait",
 "candid",
 "dfn_candid",
 "dfn_core",
 "ic-base-types",
 "ic-cdk",
]

[[package]]
name = "ic-nervous-system-string"
version = "0.0.1"
source = "git+https://github.com/dfinity/ic?rev=f7e561c00a2745f946372f5166fd7968fa664f53#f7e561c00a2745f946372f5166fd7968fa664f53"

[[package]]
name = "ic-neurons-fund"
version = "0.0.1"
source = "git+https://github.com/dfinity/ic?rev=f7e561c00a2745f946372f5166fd7968fa664f53#f7e561c00a2745f946372f5166fd7968fa664f53"
dependencies = [
 "ic-nervous-system-common",
 "lazy_static",
 "rust_decimal",
 "rust_decimal_macros",
 "serde",
 "serde_json",
]

[[package]]
name = "ic-nns-common"
version = "0.9.0"
source = "git+https://github.com/dfinity/ic?rev=f7e561c00a2745f946372f5166fd7968fa664f53#f7e561c00a2745f946372f5166fd7968fa664f53"
dependencies = [
 "candid",
 "comparable",
 "dfn_core",
 "ic-base-types",
 "ic-crypto-sha2",
 "ic-nervous-system-common",
 "ic-nns-constants",
 "ic-protobuf",
 "ic-registry-keys",
 "ic-registry-transport",
 "ic-stable-structures",
 "ic-types",
 "lazy_static",
 "num-traits",
 "on_wire",
 "prost",
 "serde",
 "serde_bytes",
 "sha2 0.10.8",
]

[[package]]
name = "ic-nns-constants"
version = "0.9.0"
source = "git+https://github.com/dfinity/ic?rev=f7e561c00a2745f946372f5166fd7968fa664f53#f7e561c00a2745f946372f5166fd7968fa664f53"
dependencies = [
 "ic-base-types",
 "maplit",
]

[[package]]
name = "ic-nns-governance-api"
version = "0.9.0"
source = "git+https://github.com/dfinity/ic?rev=f7e561c00a2745f946372f5166fd7968fa664f53#f7e561c00a2745f946372f5166fd7968fa664f53"
dependencies = [
 "bytes",
 "candid",
 "comparable",
 "ic-base-types",
 "ic-crypto-sha2",
 "ic-nervous-system-clients",
 "ic-nervous-system-common-validation",
 "ic-nervous-system-proto",
 "ic-nns-common",
 "ic-protobuf",
 "ic-sns-root",
 "ic-sns-swap",
 "ic-types",
 "ic-utils 0.9.0",
 "icp-ledger",
 "itertools 0.12.1",
 "prost",
 "serde",
 "serde_bytes",
 "strum",
 "strum_macros",
]

[[package]]
name = "ic-nns-handler-root-interface"
version = "0.1.0"
source = "git+https://github.com/dfinity/ic?rev=f7e561c00a2745f946372f5166fd7968fa664f53#f7e561c00a2745f946372f5166fd7968fa664f53"
dependencies = [
 "async-trait",
 "candid",
 "dfn_candid",
 "dfn_core",
 "ic-base-types",
 "ic-nervous-system-clients",
 "ic-nns-constants",
 "serde",
]

[[package]]
name = "ic-protobuf"
version = "0.9.0"
source = "git+https://github.com/dfinity/ic?rev=f7e561c00a2745f946372f5166fd7968fa664f53#f7e561c00a2745f946372f5166fd7968fa664f53"
dependencies = [
 "bincode",
 "candid",
 "erased-serde",
 "prost",
 "serde",
 "serde_json",
 "slog",
]

[[package]]
name = "ic-registry-keys"
version = "0.9.0"
source = "git+https://github.com/dfinity/ic?rev=f7e561c00a2745f946372f5166fd7968fa664f53#f7e561c00a2745f946372f5166fd7968fa664f53"
dependencies = [
 "candid",
 "ic-base-types",
 "ic-management-canister-types",
 "ic-types",
 "serde",
]

[[package]]
name = "ic-registry-subnet-type"
version = "0.9.0"
source = "git+https://github.com/dfinity/ic?rev=f7e561c00a2745f946372f5166fd7968fa664f53#f7e561c00a2745f946372f5166fd7968fa664f53"
dependencies = [
 "candid",
 "ic-protobuf",
 "serde",
 "strum",
 "strum_macros",
]

[[package]]
name = "ic-registry-transport"
version = "0.9.0"
source = "git+https://github.com/dfinity/ic?rev=f7e561c00a2745f946372f5166fd7968fa664f53#f7e561c00a2745f946372f5166fd7968fa664f53"
dependencies = [
 "candid",
 "ic-base-types",
 "ic-protobuf",
 "prost",
 "serde",
]

[[package]]
name = "ic-sns-cli"
version = "0.9.0"
source = "git+https://github.com/dfinity/ic?rev=f7e561c00a2745f946372f5166fd7968fa664f53#f7e561c00a2745f946372f5166fd7968fa664f53"
dependencies = [
 "anyhow",
 "base64 0.13.1",
 "candid",
 "clap 4.5.17",
 "futures",
 "hex",
 "ic-agent 0.37.1 (registry+https://github.com/rust-lang/crates.io-index)",
 "ic-base-types",
 "ic-crypto-sha2",
 "ic-nervous-system-agent",
 "ic-nervous-system-common",
 "ic-nervous-system-common-test-keys",
 "ic-nervous-system-humanize",
 "ic-nervous-system-proto",
 "ic-nns-common",
 "ic-nns-constants",
 "ic-nns-governance-api",
 "ic-sns-governance",
 "ic-sns-init",
 "ic-sns-root",
 "ic-sns-wasm",
 "itertools 0.12.1",
 "json-patch",
 "pretty_assertions",
 "serde",
 "serde_json",
 "serde_yaml",
 "tempfile",
 "thiserror",
 "tokio",
]

[[package]]
name = "ic-sns-governance"
version = "0.9.0"
source = "git+https://github.com/dfinity/ic?rev=f7e561c00a2745f946372f5166fd7968fa664f53#f7e561c00a2745f946372f5166fd7968fa664f53"
dependencies = [
 "async-trait",
 "base64 0.13.1",
 "build-info",
 "build-info-build",
 "candid",
 "clap 3.2.25",
 "comparable",
 "dfn_candid",
 "dfn_core",
 "hex",
 "ic-base-types",
 "ic-canister-log",
 "ic-canister-profiler",
 "ic-canisters-http-types",
 "ic-crypto-sha2",
 "ic-icrc1-ledger",
 "ic-ledger-core",
 "ic-management-canister-types",
 "ic-metrics-encoder",
 "ic-nervous-system-canisters",
 "ic-nervous-system-clients",
 "ic-nervous-system-collections-union-multi-map",
 "ic-nervous-system-common",
 "ic-nervous-system-common-build-metadata",
 "ic-nervous-system-common-validation",
 "ic-nervous-system-governance",
 "ic-nervous-system-lock",
 "ic-nervous-system-proto",
 "ic-nervous-system-root",
 "ic-nervous-system-runtime",
 "ic-nns-constants",
 "ic-protobuf",
 "ic-sns-governance-proposal-criticality",
 "ic-sns-governance-proposals-amount-total-limit",
 "ic-sns-governance-token-valuation",
 "ic-utils 0.9.0",
 "icp-ledger",
 "icrc-ledger-client",
 "icrc-ledger-types",
 "lazy_static",
 "maplit",
 "num-traits",
 "prost",
 "prost-build",
 "rand",
 "rand_chacha",
 "rust_decimal",
 "rust_decimal_macros",
 "serde",
 "serde_bytes",
 "strum",
 "strum_macros",
]

[[package]]
name = "ic-sns-governance-proposal-criticality"
version = "0.0.1"
source = "git+https://github.com/dfinity/ic?rev=f7e561c00a2745f946372f5166fd7968fa664f53#f7e561c00a2745f946372f5166fd7968fa664f53"
dependencies = [
 "ic-nervous-system-proto",
]

[[package]]
name = "ic-sns-governance-proposals-amount-total-limit"
version = "0.0.1"
source = "git+https://github.com/dfinity/ic?rev=f7e561c00a2745f946372f5166fd7968fa664f53#f7e561c00a2745f946372f5166fd7968fa664f53"
dependencies = [
 "ic-sns-governance-token-valuation",
 "num-traits",
 "rust_decimal",
 "rust_decimal_macros",
]

[[package]]
name = "ic-sns-governance-token-valuation"
version = "0.0.1"
source = "git+https://github.com/dfinity/ic?rev=f7e561c00a2745f946372f5166fd7968fa664f53#f7e561c00a2745f946372f5166fd7968fa664f53"
dependencies = [
 "async-trait",
 "candid",
 "cycles-minting-canister",
 "futures",
 "ic-base-types",
 "ic-cdk",
 "ic-nervous-system-common",
 "ic-nervous-system-runtime",
 "ic-nervous-system-string",
 "ic-nns-constants",
 "ic-sns-swap-proto-library",
 "icrc-ledger-types",
 "mockall",
 "rust_decimal",
]

[[package]]
name = "ic-sns-init"
version = "0.9.0"
source = "git+https://github.com/dfinity/ic?rev=f7e561c00a2745f946372f5166fd7968fa664f53#f7e561c00a2745f946372f5166fd7968fa664f53"
dependencies = [
 "base64 0.13.1",
 "candid",
 "ic-base-types",
 "ic-icrc1-index-ng",
 "ic-icrc1-ledger",
 "ic-ledger-canister-core",
 "ic-ledger-core",
 "ic-nervous-system-common",
 "ic-nervous-system-proto",
 "ic-nns-constants",
 "ic-nns-governance-api",
 "ic-sns-governance",
 "ic-sns-root",
 "ic-sns-swap",
 "icrc-ledger-types",
 "isocountry",
 "lazy_static",
 "maplit",
 "prost",
 "serde",
 "serde_yaml",
]

[[package]]
name = "ic-sns-root"
version = "0.9.0"
source = "git+https://github.com/dfinity/ic?rev=f7e561c00a2745f946372f5166fd7968fa664f53#f7e561c00a2745f946372f5166fd7968fa664f53"
dependencies = [
 "async-trait",
 "build-info",
 "build-info-build",
 "candid",
 "comparable",
 "futures",
 "ic-base-types",
 "ic-canister-log",
 "ic-canisters-http-types",
 "ic-cdk",
 "ic-cdk-macros 0.9.0",
 "ic-cdk-timers",
 "ic-management-canister-types",
 "ic-metrics-encoder",
 "ic-nervous-system-clients",
 "ic-nervous-system-common",
 "ic-nervous-system-common-build-metadata",
 "ic-nervous-system-root",
 "ic-nervous-system-runtime",
 "ic-nns-constants",
 "ic-sns-swap",
 "icrc-ledger-types",
 "prost",
 "serde",
]

[[package]]
name = "ic-sns-swap"
version = "0.9.0"
source = "git+https://github.com/dfinity/ic?rev=f7e561c00a2745f946372f5166fd7968fa664f53#f7e561c00a2745f946372f5166fd7968fa664f53"
dependencies = [
 "async-trait",
 "build-info",
 "build-info-build",
 "candid",
 "comparable",
 "dfn_candid",
 "dfn_core",
 "hex",
 "ic-base-types",
 "ic-canister-log",
 "ic-canisters-http-types",
 "ic-ledger-core",
 "ic-metrics-encoder",
 "ic-nervous-system-canisters",
 "ic-nervous-system-clients",
 "ic-nervous-system-common",
 "ic-nervous-system-proto",
 "ic-nervous-system-runtime",
 "ic-neurons-fund",
 "ic-sns-governance",
 "ic-stable-structures",
 "ic-utils 0.9.0",
 "icp-ledger",
 "icrc-ledger-types",
 "itertools 0.12.1",
 "lazy_static",
 "maplit",
 "prost",
 "rust_decimal",
 "rust_decimal_macros",
 "serde",
 "serde_bytes",
]

[[package]]
name = "ic-sns-swap-proto-library"
version = "0.0.1"
source = "git+https://github.com/dfinity/ic?rev=f7e561c00a2745f946372f5166fd7968fa664f53#f7e561c00a2745f946372f5166fd7968fa664f53"
dependencies = [
 "candid",
 "comparable",
 "ic-base-types",
 "ic-nervous-system-proto",
 "ic-utils 0.9.0",
 "prost",
 "serde",
 "serde_bytes",
]

[[package]]
name = "ic-sns-wasm"
version = "1.0.0"
source = "git+https://github.com/dfinity/ic?rev=f7e561c00a2745f946372f5166fd7968fa664f53#f7e561c00a2745f946372f5166fd7968fa664f53"
dependencies = [
 "async-trait",
 "candid",
 "dfn_candid",
 "dfn_core",
 "dfn_http_metrics",
 "futures",
 "hex",
 "ic-base-types",
 "ic-cdk",
 "ic-crypto-sha2",
 "ic-management-canister-types",
 "ic-metrics-encoder",
 "ic-nervous-system-clients",
 "ic-nervous-system-common",
 "ic-nervous-system-proto",
 "ic-nervous-system-runtime",
 "ic-nns-constants",
 "ic-nns-handler-root-interface",
 "ic-sns-governance",
 "ic-sns-init",
 "ic-sns-root",
 "ic-types",
 "ic-utils 0.9.0",
 "ic-wasm",
 "icrc-ledger-types",
 "maplit",
 "prost",
 "serde",
 "serde_bytes",
 "serde_json",
]

[[package]]
name = "ic-stable-structures"
version = "0.6.5"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "03f3044466a69802de74e710dc0300b706a05696a0531c942ca856751a13b0db"
dependencies = [
 "ic_principal",
]

[[package]]
name = "ic-sys"
version = "0.9.0"
source = "git+https://github.com/dfinity/ic?rev=f7e561c00a2745f946372f5166fd7968fa664f53#f7e561c00a2745f946372f5166fd7968fa664f53"
dependencies = [
 "cvt",
 "hex",
 "ic-crypto-sha2",
 "lazy_static",
 "libc",
 "nix 0.24.3",
 "phantom_newtype",
 "prost",
 "rand",
 "thiserror",
 "tokio",
 "wsl",
]

[[package]]
name = "ic-transport-types"
version = "0.37.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "875dc4704780383112e8e8b5063a1b98de114321d0c7d3e7f635dcf360a57fba"
dependencies = [
 "candid",
 "hex",
 "ic-certification",
 "leb128",
 "serde",
 "serde_bytes",
 "serde_repr",
 "sha2 0.10.8",
 "thiserror",
]

[[package]]
name = "ic-transport-types"
version = "0.37.1"
source = "git+https://github.com/dfinity/agent-rs?rev=6e11a350112f9b907c4d590d8217f340e153d898#6e11a350112f9b907c4d590d8217f340e153d898"
dependencies = [
 "candid",
 "hex",
 "ic-certification",
 "leb128",
 "serde",
 "serde_bytes",
 "serde_repr",
 "sha2 0.10.8",
 "thiserror",
]

[[package]]
name = "ic-types"
version = "0.9.0"
source = "git+https://github.com/dfinity/ic?rev=f7e561c00a2745f946372f5166fd7968fa664f53#f7e561c00a2745f946372f5166fd7968fa664f53"
dependencies = [
 "base64 0.13.1",
 "bincode",
 "candid",
 "chrono",
 "hex",
 "ic-base-types",
 "ic-btc-replica-types",
 "ic-crypto-internal-types",
 "ic-crypto-sha2",
 "ic-crypto-tree-hash",
 "ic-error-types",
 "ic-limits",
 "ic-management-canister-types",
 "ic-protobuf",
 "ic-utils 0.9.0",
 "ic-validate-eq",
 "ic-validate-eq-derive",
 "maplit",
 "once_cell",
 "phantom_newtype",
 "prost",
 "serde",
 "serde_bytes",
 "serde_cbor",
 "serde_json",
 "serde_with",
 "strum",
 "strum_macros",
 "thiserror",
 "thousands",
]

[[package]]
name = "ic-utils"
version = "0.9.0"
source = "git+https://github.com/dfinity/ic?rev=f7e561c00a2745f946372f5166fd7968fa664f53#f7e561c00a2745f946372f5166fd7968fa664f53"
dependencies = [
 "hex",
 "scoped_threadpool",
 "serde",
 "serde_bytes",
]

[[package]]
name = "ic-utils"
version = "0.37.1"
source = "git+https://github.com/dfinity/agent-rs?rev=6e11a350112f9b907c4d590d8217f340e153d898#6e11a350112f9b907c4d590d8217f340e153d898"
dependencies = [
 "async-trait",
 "candid",
 "futures-util",
 "ic-agent 0.37.1 (git+https://github.com/dfinity/agent-rs?rev=6e11a350112f9b907c4d590d8217f340e153d898)",
 "once_cell",
 "semver",
 "serde",
 "serde_bytes",
 "sha2 0.10.8",
 "strum",
 "strum_macros",
 "thiserror",
 "time",
 "tokio",
]

[[package]]
name = "ic-validate-eq"
version = "0.0.0"
source = "git+https://github.com/dfinity/ic?rev=f7e561c00a2745f946372f5166fd7968fa664f53#f7e561c00a2745f946372f5166fd7968fa664f53"
dependencies = [
 "ic-validate-eq-derive",
]

[[package]]
name = "ic-validate-eq-derive"
version = "0.0.0"
source = "git+https://github.com/dfinity/ic?rev=f7e561c00a2745f946372f5166fd7968fa664f53#f7e561c00a2745f946372f5166fd7968fa664f53"
dependencies = [
 "darling 0.20.10",
 "proc-macro2",
 "quote",
 "syn 1.0.109",
]

[[package]]
name = "ic-verify-bls-signature"
version = "0.5.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "d420b25c0091059f6c3c23a21427a81915e6e0aca3b79e0d403ed767f286a3b9"
dependencies = [
 "hex",
 "ic_bls12_381",
 "lazy_static",
 "pairing",
 "rand",
 "sha2 0.10.8",
]

[[package]]
name = "ic-wasm"
version = "0.8.5"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "5574bf249d201ddd2c27c3fdf178ddacb1be1c705c8a5b4c1339c393758f2bf2"
dependencies = [
 "anyhow",
 "candid",
 "clap 4.5.17",
 "libflate",
 "rustc-demangle",
 "serde",
 "serde_json",
 "thiserror",
 "walrus",
]

[[package]]
name = "ic-xrc-types"
version = "1.2.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "b1a2b2eaa332201f4abbd1192a307f7a5b6ea55d077a7f489ac62bf8e358b5a2"
dependencies = [
 "candid",
 "serde",
]

[[package]]
name = "ic0"
version = "0.18.11"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "576c539151d4769fb4d1a0c25c4108dd18facd04c5695b02cf2d226ab4e43aa5"

[[package]]
name = "ic0"
version = "0.21.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "a54b5297861c651551676e8c43df805dad175cc33bc97dbd992edbbb85dcbcdf"

[[package]]
name = "ic_bls12_381"
version = "0.10.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "22c65787944f32af084dffd0c68c1e544237b76e215654ddea8cd9f527dd8b69"
dependencies = [
 "digest 0.10.7",
 "ff 0.13.0",
 "group 0.13.0",
 "pairing",
 "rand_core",
 "subtle",
]

[[package]]
name = "ic_principal"
version = "0.1.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "1762deb6f7c8d8c2bdee4b6c5a47b60195b74e9b5280faa5ba29692f8e17429c"
dependencies = [
 "crc32fast",
 "data-encoding",
 "serde",
 "sha2 0.10.8",
 "thiserror",
]

[[package]]
name = "icp-ledger"
version = "0.9.0"
source = "git+https://github.com/dfinity/ic?rev=f7e561c00a2745f946372f5166fd7968fa664f53#f7e561c00a2745f946372f5166fd7968fa664f53"
dependencies = [
 "candid",
 "comparable",
 "crc32fast",
 "dfn_candid",
 "dfn_core",
 "dfn_protobuf",
 "hex",
 "ic-base-types",
 "ic-cdk",
 "ic-crypto-sha2",
 "ic-ledger-canister-core",
 "ic-ledger-core",
 "ic-ledger-hash-of",
 "icrc-ledger-types",
 "lazy_static",
 "num-traits",
 "on_wire",
 "prost",
 "serde",
 "serde_bytes",
 "serde_cbor",
 "strum",
 "strum_macros",
]

[[package]]
name = "icrc-ledger-client"
version = "0.1.2"
source = "git+https://github.com/dfinity/ic?rev=f7e561c00a2745f946372f5166fd7968fa664f53#f7e561c00a2745f946372f5166fd7968fa664f53"
dependencies = [
 "async-trait",
 "candid",
 "icrc-ledger-types",
 "serde",
]

[[package]]
name = "icrc-ledger-types"
version = "0.1.6"
source = "git+https://github.com/dfinity/ic?rev=f7e561c00a2745f946372f5166fd7968fa664f53#f7e561c00a2745f946372f5166fd7968fa664f53"
dependencies = [
 "base32",
 "candid",
 "crc32fast",
 "hex",
 "itertools 0.12.1",
 "num-bigint 0.4.6",
 "num-traits",
 "serde",
 "serde_bytes",
 "sha2 0.10.8",
 "strum",
 "time",
]

[[package]]
name = "id-arena"
version = "2.2.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "25a2bc672d1148e28034f176e01fffebb08b35768468cc954630da77a1449005"

[[package]]
name = "ident_case"
version = "1.0.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "b9e0384b61958566e926dc50660321d12159025e767c18e043daf26b70104c39"

[[package]]
name = "idna"
version = "0.5.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "634d9b1461af396cad843f47fdba5597a4f9e6ddd4bfb6ff5d85028c25cb12f6"
dependencies = [
 "unicode-bidi",
 "unicode-normalization",
]

[[package]]
name = "indexmap"
version = "1.9.3"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "bd070e393353796e801d209ad339e89596eb4c8d430d18ede6a1cced8fafbd99"
dependencies = [
 "autocfg",
 "hashbrown 0.12.3",
]

[[package]]
name = "indexmap"
version = "2.5.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "68b900aa2f7301e21c36462b170ee99994de34dff39a4a6a528e80e7376d07e5"
dependencies = [
 "equivalent",
 "hashbrown 0.14.5",
 "serde",
]

[[package]]
name = "inout"
version = "0.1.3"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "a0c10553d664a4d0bcff9f4215d0aac67a639cc68ef660840afe309b807bc9f5"
dependencies = [
 "generic-array",
]

[[package]]
name = "instant"
version = "0.1.13"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "e0242819d153cba4b4b05a5a8f2a7e9bbf97b6055b2a002b395c96b5ff3c0222"
dependencies = [
 "cfg-if",
]

[[package]]
name = "io-lifetimes"
version = "1.0.11"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "eae7b9aee968036d54dce06cebaefd919e4472e753296daccd6d344e3e2df0c2"
dependencies = [
 "hermit-abi 0.3.9",
 "libc",
 "windows-sys 0.48.0",
]

[[package]]
name = "ipnet"
version = "2.10.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "187674a687eed5fe42285b40c6291f9a01517d415fad1c3cbc6a9f778af7fcd4"

[[package]]
name = "is-terminal"
version = "0.4.13"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "261f68e344040fbd0edea105bef17c66edf46f984ddb1115b775ce31be948f4b"
dependencies = [
 "hermit-abi 0.4.0",
 "libc",
 "windows-sys 0.52.0",
]

[[package]]
name = "is_terminal_polyfill"
version = "1.70.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "7943c866cc5cd64cbc25b2e01621d07fa8eb2a1a23160ee81ce38704e97b8ecf"

[[package]]
name = "isocountry"
version = "0.3.2"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "1ea1dc4bf0fb4904ba83ffdb98af3d9c325274e92e6e295e4151e86c96363e04"
dependencies = [
 "serde",
 "thiserror",
]

[[package]]
name = "itertools"
version = "0.10.5"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "b0fd2260e829bddf4cb6ea802289de2f86d6a7a690192fbe91b3f46e0f2c8473"
dependencies = [
 "either",
]

[[package]]
name = "itertools"
version = "0.12.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "ba291022dbbd398a455acf126c1e341954079855bc60dfdda641363bd6922569"
dependencies = [
 "either",
]

[[package]]
name = "itoa"
version = "1.0.11"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "49f1f14873335454500d59611f1cf4a4b0f786f9ac11f4312a78e4cf2566695b"

[[package]]
name = "jobserver"
version = "0.1.32"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "48d1dbcbbeb6a7fec7e059840aa538bd62aaccf972c7346c4d9d2059312853d0"
dependencies = [
 "libc",
]

[[package]]
name = "js-sys"
version = "0.3.70"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "1868808506b929d7b0cfa8f75951347aa71bb21144b7791bae35d9bccfcfe37a"
dependencies = [
 "wasm-bindgen",
]

[[package]]
name = "json-patch"
version = "0.2.7"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "eb3fa5a61630976fc4c353c70297f2e93f1930e3ccee574d59d618ccbd5154ce"
dependencies = [
 "serde",
 "serde_json",
 "treediff",
]

[[package]]
name = "json5"
version = "0.4.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "96b0db21af676c1ce64250b5f40f3ce2cf27e4e47cb91ed91eb6fe9350b430c1"
dependencies = [
 "pest",
 "pest_derive",
 "serde",
]

[[package]]
name = "k256"
version = "0.11.6"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "72c1e0b51e7ec0a97369623508396067a486bd0cbed95a2659a4b863d28cfc8b"
dependencies = [
 "cfg-if",
 "ecdsa 0.14.8",
 "elliptic-curve 0.12.3",
 "sha2 0.10.8",
 "sha3",
]

[[package]]
name = "k256"
version = "0.13.3"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "956ff9b67e26e1a6a866cb758f12c6f8746208489e3e4a4b5580802f2f0a587b"
dependencies = [
 "cfg-if",
 "ecdsa 0.16.9",
 "elliptic-curve 0.13.8",
 "once_cell",
 "sha2 0.10.8",
 "signature 2.2.0",
]

[[package]]
name = "keccak"
version = "0.1.5"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "ecc2af9a1119c51f12a14607e783cb977bde58bc069ff0c3da1095e635d70654"
dependencies = [
 "cpufeatures",
]

[[package]]
name = "keyring"
version = "1.2.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "ba264b266563c1363dcce004776cbf198d7422a4262f77f4ca285bf26ae30955"
dependencies = [
 "byteorder",
 "secret-service",
 "security-framework",
 "winapi",
]

[[package]]
name = "lazy_static"
version = "1.5.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "bbd2bcb4c963f2ddae06a2efc7e9f3591312473c50c6685e1f298068316e66fe"

[[package]]
name = "leb128"
version = "0.2.5"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "884e2677b40cc8c339eaefcb701c32ef1fd2493d71118dc0ca4b6a736c93bd67"

[[package]]
name = "libc"
version = "0.2.158"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "d8adc4bb1803a324070e64a98ae98f38934d91957a99cfb3a43dcbc01bc56439"

[[package]]
name = "libflate"
version = "2.1.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "45d9dfdc14ea4ef0900c1cddbc8dcd553fbaacd8a4a282cf4018ae9dd04fb21e"
dependencies = [
 "adler32",
 "core2",
 "crc32fast",
 "dary_heap",
 "libflate_lz77",
]

[[package]]
name = "libflate_lz77"
version = "2.1.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "e6e0d73b369f386f1c44abd9c570d5318f55ccde816ff4b562fa452e5182863d"
dependencies = [
 "core2",
 "hashbrown 0.14.5",
 "rle-decode-fast",
]

[[package]]
name = "libloading"
version = "0.5.2"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "f2b111a074963af1d37a139918ac6d49ad1d0d5e47f72fd55388619691a7d753"
dependencies = [
 "cc",
 "winapi",
]

[[package]]
name = "libm"
version = "0.2.8"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "4ec2a862134d2a7d32d7983ddcdd1c4923530833c9f2ea1a44fc5fa473989058"

[[package]]
name = "libredox"
version = "0.1.3"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "c0ff37bd590ca25063e35af745c343cb7a0271906fb7b37e4813e8f79f00268d"
dependencies = [
 "bitflags 2.6.0",
 "libc",
 "redox_syscall",
]

[[package]]
name = "libz-ng-sys"
version = "1.1.16"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "4436751a01da56f1277f323c80d584ffad94a3d14aecd959dd0dff75aa73a438"
dependencies = [
 "cmake",
 "libc",
]

[[package]]
name = "linux-raw-sys"
version = "0.3.8"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "ef53942eb7bf7ff43a617b3e2c1c4a5ecf5944a7c1bc12d7ee39bbb15e5c1519"

[[package]]
name = "linux-raw-sys"
version = "0.4.14"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "78b3ae25bc7c8c38cec158d1f2757ee79e9b3740fbc7ccf0e59e4b08d793fa89"

[[package]]
name = "lock_api"
version = "0.4.12"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "07af8b9cdd281b7915f413fa73f29ebd5d55d0d3f0155584dade1ff18cea1b17"
dependencies = [
 "autocfg",
 "scopeguard",
]

[[package]]
name = "log"
version = "0.4.22"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "a7a70ba024b9dc04c27ea2f0c0548feb474ec5c54bba33a7f72f873a39d07b24"

[[package]]
name = "lzma-sys"
version = "0.1.20"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "5fda04ab3764e6cde78b9974eec4f779acaba7c4e84b36eca3cf77c581b85d27"
dependencies = [
 "cc",
 "libc",
 "pkg-config",
]

[[package]]
name = "maplit"
version = "1.0.2"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "3e2e65a1a2e43cfcb47a895c4c8b10d1f4a61097f9f254f183aee60cad9c651d"

[[package]]
name = "memchr"
version = "2.7.4"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "78ca9ab1a0babb1e7d5695e3530886289c18cf2f87ec19a575a0abdce112e3a3"

[[package]]
name = "memoffset"
version = "0.6.5"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "5aa361d4faea93603064a027415f07bd8e1d5c88c9fbf68bf56a285428fd79ce"
dependencies = [
 "autocfg",
]

[[package]]
name = "merlin"
version = "3.0.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "58c38e2799fc0978b65dfff8023ec7843e2330bb462f19198840b34b6582397d"
dependencies = [
 "byteorder",
 "keccak",
 "rand_core",
 "zeroize",
]

[[package]]
name = "mime"
version = "0.3.17"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "6877bb514081ee2a7ff5ef9de3281f14a4dd4bceac4c09388074a6b5df8a139a"

[[package]]
name = "mime_guess"
version = "2.0.5"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "f7c44f8e672c00fe5308fa235f821cb4198414e1c77935c1ab6948d3fd78550e"
dependencies = [
 "mime",
 "unicase",
]

[[package]]
name = "miniz_oxide"
version = "0.8.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "e2d80299ef12ff69b16a84bb182e3b9df68b5a91574d3d4fa6e41b65deec4df1"
dependencies = [
 "adler2",
]

[[package]]
name = "mio"
version = "1.0.2"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "80e04d1dcff3aae0704555fe5fee3bcfaf3d1fdf8a7e521d5b9d2b42acb52cec"
dependencies = [
 "hermit-abi 0.3.9",
 "libc",
 "wasi",
 "windows-sys 0.52.0",
]

[[package]]
name = "mockall"
version = "0.13.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "d4c28b3fb6d753d28c20e826cd46ee611fda1cf3cde03a443a974043247c065a"
dependencies = [
 "cfg-if",
 "downcast",
 "fragile",
 "mockall_derive",
 "predicates",
 "predicates-tree",
]

[[package]]
name = "mockall_derive"
version = "0.13.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "341014e7f530314e9a1fdbc7400b244efea7122662c96bfa248c31da5bfb2020"
dependencies = [
 "cfg-if",
 "proc-macro2",
 "quote",
 "syn 2.0.77",
]

[[package]]
name = "multimap"
version = "0.10.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "defc4c55412d89136f966bbb339008b474350e5e6e78d2714439c386b3137a03"

[[package]]
name = "native-tls"
version = "0.2.12"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "a8614eb2c83d59d1c8cc974dd3f920198647674a0a035e1af1fa58707e317466"
dependencies = [
 "libc",
 "log",
 "openssl",
 "openssl-probe",
 "openssl-sys",
 "schannel",
 "security-framework",
 "security-framework-sys",
 "tempfile",
]

[[package]]
name = "nb-connect"
version = "1.2.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "b1bb540dc6ef51cfe1916ec038ce7a620daf3a111e2502d745197cd53d6bca15"
dependencies = [
 "libc",
 "socket2 0.4.10",
]

[[package]]
name = "nix"
version = "0.22.3"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "e4916f159ed8e5de0082076562152a76b7a1f64a01fd9d1e0fea002c37624faf"
dependencies = [
 "bitflags 1.3.2",
 "cc",
 "cfg-if",
 "libc",
 "memoffset",
]

[[package]]
name = "nix"
version = "0.24.3"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "fa52e972a9a719cecb6864fb88568781eb706bac2cd1d4f04a648542dbf78069"
dependencies = [
 "bitflags 1.3.2",
 "cfg-if",
 "libc",
 "memoffset",
]

[[package]]
name = "nns"
version = "0.4.5"
dependencies = [
 "anyhow",
 "backoff",
 "candid",
 "clap 4.5.17",
 "crc32fast",
 "dfx-core",
 "dfx-extensions-utils",
 "fn-error-context",
 "futures-util",
 "hex",
 "ic-agent 0.37.1 (git+https://github.com/dfinity/agent-rs?rev=6e11a350112f9b907c4d590d8217f340e153d898)",
 "ic-http-utils",
 "ic-icp-index",
 "ic-icrc1-index-ng",
 "ic-icrc1-ledger",
 "ic-sns-cli",
 "ic-utils 0.37.1",
 "reqwest 0.11.27",
 "rust_decimal",
 "serde",
 "sha2 0.10.8",
 "slog",
 "tempfile",
 "tokio",
]

[[package]]
name = "num"
version = "0.4.3"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "35bd024e8b2ff75562e5f34e7f4905839deb4b22955ef5e73d2fea1b9813cb23"
dependencies = [
 "num-bigint 0.4.6",
 "num-complex",
 "num-integer",
 "num-iter",
 "num-rational",
 "num-traits",
]

[[package]]
name = "num-bigint"
version = "0.2.6"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "090c7f9998ee0ff65aa5b723e4009f7b217707f1fb5ea551329cc4d6231fb304"
dependencies = [
 "autocfg",
 "num-integer",
 "num-traits",
]

[[package]]
name = "num-bigint"
version = "0.4.6"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "a5e44f723f1133c9deac646763579fdb3ac745e418f2a7af9cd0c431da1f20b9"
dependencies = [
 "num-integer",
 "num-traits",
 "serde",
]

[[package]]
name = "num-complex"
version = "0.4.6"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "73f88a1307638156682bada9d7604135552957b7818057dcef22705b4d509495"
dependencies = [
 "num-traits",
]

[[package]]
name = "num-conv"
version = "0.1.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "51d515d32fb182ee37cda2ccdcb92950d6a3c2893aa280e540671c2cd0f3b1d9"

[[package]]
name = "num-integer"
version = "0.1.46"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "7969661fd2958a5cb096e56c8e1ad0444ac2bbcd0061bd28660485a44879858f"
dependencies = [
 "num-traits",
]

[[package]]
name = "num-iter"
version = "0.1.45"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "1429034a0490724d0075ebb2bc9e875d6503c3cf69e235a8941aa757d83ef5bf"
dependencies = [
 "autocfg",
 "num-integer",
 "num-traits",
]

[[package]]
name = "num-rational"
version = "0.4.2"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "f83d14da390562dca69fc84082e73e548e1ad308d24accdedd2720017cb37824"
dependencies = [
 "num-bigint 0.4.6",
 "num-integer",
 "num-traits",
]

[[package]]
name = "num-traits"
version = "0.2.19"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "071dfc062690e90b734c0b2273ce72ad0ffa95f0c74596bc250dcfd960262841"
dependencies = [
 "autocfg",
 "libm",
]

[[package]]
name = "object"
version = "0.36.4"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "084f1a5821ac4c651660a94a7153d27ac9d8a53736203f58b31945ded098070a"
dependencies = [
 "memchr",
]

[[package]]
name = "on_wire"
version = "0.9.0"
source = "git+https://github.com/dfinity/ic?rev=f7e561c00a2745f946372f5166fd7968fa664f53#f7e561c00a2745f946372f5166fd7968fa664f53"

[[package]]
name = "once_cell"
version = "1.19.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "3fdb12b2476b595f9358c5161aa467c2438859caa136dec86c26fdd2efe17b92"

[[package]]
name = "opaque-debug"
version = "0.3.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "c08d65885ee38876c4f86fa503fb49d7b507c2b62552df7c70b2fce627e06381"

[[package]]
name = "openssl"
version = "0.10.66"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "9529f4786b70a3e8c61e11179af17ab6188ad8d0ded78c5529441ed39d4bd9c1"
dependencies = [
 "bitflags 2.6.0",
 "cfg-if",
 "foreign-types",
 "libc",
 "once_cell",
 "openssl-macros",
 "openssl-sys",
]

[[package]]
name = "openssl-macros"
version = "0.1.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "a948666b637a0f465e8564c73e89d4dde00d72d4d473cc972f390fc3dcee7d9c"
dependencies = [
 "proc-macro2",
 "quote",
 "syn 2.0.77",
]

[[package]]
name = "openssl-probe"
version = "0.1.5"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "ff011a302c396a5197692431fc1948019154afc178baf7d8e37367442a4601cf"

[[package]]
name = "openssl-src"
version = "300.3.2+3.3.2"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "a211a18d945ef7e648cc6e0058f4c548ee46aab922ea203e0d30e966ea23647b"
dependencies = [
 "cc",
]

[[package]]
name = "openssl-sys"
version = "0.9.103"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "7f9e8deee91df40a943c71b917e5874b951d32a802526c85721ce3b776c929d6"
dependencies = [
 "cc",
 "libc",
 "openssl-src",
 "pkg-config",
 "vcpkg",
]

[[package]]
name = "os_str_bytes"
version = "6.6.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "e2355d85b9a3786f481747ced0e0ff2ba35213a1f9bd406ed906554d7af805a1"

[[package]]
name = "p256"
version = "0.13.2"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "c9863ad85fa8f4460f9c48cb909d38a0d689dba1f6f6988a5e3e0d31071bcd4b"
dependencies = [
 "ecdsa 0.16.9",
 "elliptic-curve 0.13.8",
 "primeorder",
 "sha2 0.10.8",
]

[[package]]
name = "pairing"
version = "0.23.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "81fec4625e73cf41ef4bb6846cafa6d44736525f442ba45e407c4a000a13996f"
dependencies = [
 "group 0.13.0",
]

[[package]]
name = "parking"
version = "2.2.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "f38d5652c16fde515bb1ecef450ab0f6a219d619a7274976324d5e377f7dceba"

[[package]]
name = "parking_lot"
version = "0.12.3"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "f1bf18183cf54e8d6059647fc3063646a1801cf30896933ec2311622cc4b9a27"
dependencies = [
 "lock_api",
 "parking_lot_core",
]

[[package]]
name = "parking_lot_core"
version = "0.9.10"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "1e401f977ab385c9e4e3ab30627d6f26d00e2c73eef317493c4ec6d468726cf8"
dependencies = [
 "cfg-if",
 "libc",
 "redox_syscall",
 "smallvec",
 "windows-targets 0.52.6",
]

[[package]]
name = "password-hash"
version = "0.4.2"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "7676374caaee8a325c9e7a2ae557f216c5563a171d6997b0ef8a65af35147700"
dependencies = [
 "base64ct",
 "rand_core",
 "subtle",
]

[[package]]
name = "paste"
version = "1.0.15"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "57c0d7b74b563b49d38dae00a0c37d4d6de9b432382b2892f0574ddcae73fd0a"

[[package]]
name = "pbkdf2"
version = "0.11.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "83a0692ec44e4cf1ef28ca317f14f8f07da2d95ec3fa01f86e4467b725e60917"
dependencies = [
 "digest 0.10.7",
]

[[package]]
name = "pem"
version = "1.1.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "a8835c273a76a90455d7344889b0964598e3316e2a79ede8e36f16bdcf2228b8"
dependencies = [
 "base64 0.13.1",
]

[[package]]
name = "pem"
version = "3.0.4"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "8e459365e590736a54c3fa561947c84837534b8e9af6fc5bf781307e82658fae"
dependencies = [
 "base64 0.22.1",
 "serde",
]

[[package]]
name = "pem-rfc7468"
version = "0.6.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "24d159833a9105500e0398934e205e0773f0b27529557134ecfc51c27646adac"
dependencies = [
 "base64ct",
]

[[package]]
name = "pem-rfc7468"
version = "0.7.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "88b39c9bfcfc231068454382784bb460aae594343fb030d46e9f50a645418412"
dependencies = [
 "base64ct",
]

[[package]]
name = "percent-encoding"
version = "2.3.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "e3148f5046208a5d56bcfc03053e3ca6334e51da8dfb19b6cdc8b306fae3283e"

[[package]]
name = "pest"
version = "2.7.12"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "9c73c26c01b8c87956cea613c907c9d6ecffd8d18a2a5908e5de0adfaa185cea"
dependencies = [
 "memchr",
 "thiserror",
 "ucd-trie",
]

[[package]]
name = "pest_derive"
version = "2.7.12"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "664d22978e2815783adbdd2c588b455b1bd625299ce36b2a99881ac9627e6d8d"
dependencies = [
 "pest",
 "pest_generator",
]

[[package]]
name = "pest_generator"
version = "2.7.12"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "a2d5487022d5d33f4c30d91c22afa240ce2a644e87fe08caad974d4eab6badbe"
dependencies = [
 "pest",
 "pest_meta",
 "proc-macro2",
 "quote",
 "syn 2.0.77",
]

[[package]]
name = "pest_meta"
version = "2.7.12"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "0091754bbd0ea592c4deb3a122ce8ecbb0753b738aa82bc055fcc2eccc8d8174"
dependencies = [
 "once_cell",
 "pest",
 "sha2 0.10.8",
]

[[package]]
name = "petgraph"
version = "0.6.5"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "b4c5cc86750666a3ed20bdaf5ca2a0344f9c67674cae0515bec2da16fbaa47db"
dependencies = [
 "fixedbitset",
 "indexmap 2.5.0",
]

[[package]]
name = "phantom_newtype"
version = "0.9.0"
source = "git+https://github.com/dfinity/ic?rev=f7e561c00a2745f946372f5166fd7968fa664f53#f7e561c00a2745f946372f5166fd7968fa664f53"
dependencies = [
 "candid",
 "num-traits",
 "serde",
 "slog",
]

[[package]]
name = "pin-project"
version = "1.1.5"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "b6bf43b791c5b9e34c3d182969b4abb522f9343702850a2e57f460d00d09b4b3"
dependencies = [
 "pin-project-internal",
]

[[package]]
name = "pin-project-internal"
version = "1.1.5"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "2f38a4412a78282e09a2cf38d195ea5420d15ba0602cb375210efbc877243965"
dependencies = [
 "proc-macro2",
 "quote",
 "syn 2.0.77",
]

[[package]]
name = "pin-project-lite"
version = "0.2.14"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "bda66fc9667c18cb2758a2ac84d1167245054bcf85d5d1aaa6923f45801bdd02"

[[package]]
name = "pin-utils"
version = "0.1.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "8b870d8c151b6f2fb93e84a13146138f05d02ed11c7e7c54f8826aaaf7c9f184"

[[package]]
name = "pkcs11"
version = "0.5.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "3aca6d67e4c8613bfe455599d0233d00735f85df2001f6bfd9bb7ac0496b10af"
dependencies = [
 "libloading",
 "num-bigint 0.2.6",
]

[[package]]
name = "pkcs8"
version = "0.9.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "9eca2c590a5f85da82668fa685c09ce2888b9430e83299debf1f34b65fd4a4ba"
dependencies = [
 "der 0.6.1",
 "spki 0.6.0",
]

[[package]]
name = "pkcs8"
version = "0.10.2"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "f950b2377845cebe5cf8b5165cb3cc1a5e0fa5cfa3e1f7f55707d8fd82e0a7b7"
dependencies = [
 "der 0.7.9",
 "spki 0.7.3",
]

[[package]]
name = "pkg-config"
version = "0.3.30"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "d231b230927b5e4ad203db57bbcbee2802f6bce620b1e4a9024a07d94e2907ec"

[[package]]
name = "polling"
version = "2.8.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "4b2d323e8ca7996b3e23126511a523f7e62924d93ecd5ae73b333815b0eb3dce"
dependencies = [
 "autocfg",
 "bitflags 1.3.2",
 "cfg-if",
 "concurrent-queue",
 "libc",
 "log",
 "pin-project-lite",
 "windows-sys 0.48.0",
]

[[package]]
name = "polyval"
version = "0.6.2"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "9d1fe60d06143b2430aa532c94cfe9e29783047f06c0d7fd359a9a51b729fa25"
dependencies = [
 "cfg-if",
 "cpufeatures",
 "opaque-debug",
 "universal-hash",
]

[[package]]
name = "powerfmt"
version = "0.2.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "439ee305def115ba05938db6eb1644ff94165c5ab5e9420d1c1bcedbba909391"

[[package]]
name = "ppv-lite86"
version = "0.2.20"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "77957b295656769bb8ad2b6a6b09d897d94f05c41b069aede1fcdaa675eaea04"
dependencies = [
 "zerocopy",
]

[[package]]
name = "predicates"
version = "3.1.2"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "7e9086cc7640c29a356d1a29fd134380bee9d8f79a17410aa76e7ad295f42c97"
dependencies = [
 "anstyle",
 "predicates-core",
]

[[package]]
name = "predicates-core"
version = "1.0.8"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "ae8177bee8e75d6846599c6b9ff679ed51e882816914eec639944d7c9aa11931"

[[package]]
name = "predicates-tree"
version = "1.0.11"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "41b740d195ed3166cd147c8047ec98db0e22ec019eb8eeb76d343b795304fb13"
dependencies = [
 "predicates-core",
 "termtree",
]

[[package]]
name = "pretty"
version = "0.12.3"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "b55c4d17d994b637e2f4daf6e5dc5d660d209d5642377d675d7a1c3ab69fa579"
dependencies = [
 "arrayvec 0.5.2",
 "typed-arena",
 "unicode-width",
]

[[package]]
name = "pretty_assertions"
version = "1.4.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "af7cee1a6c8a5b9208b3cb1061f10c0cb689087b3d8ce85fb9d2dd7a29b6ba66"
dependencies = [
 "diff",
 "yansi",
]

[[package]]
name = "prettyplease"
version = "0.2.22"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "479cf940fbbb3426c32c5d5176f62ad57549a0bb84773423ba8be9d089f5faba"
dependencies = [
 "proc-macro2",
 "syn 2.0.77",
]

[[package]]
name = "primeorder"
version = "0.13.6"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "353e1ca18966c16d9deb1c69278edbc5f194139612772bd9537af60ac231e1e6"
dependencies = [
 "elliptic-curve 0.13.8",
]

[[package]]
name = "priority-queue"
version = "1.4.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "a0bda9164fe05bc9225752d54aae413343c36f684380005398a6a8fde95fe785"
dependencies = [
 "autocfg",
 "indexmap 1.9.3",
]

[[package]]
name = "proc-macro-crate"
version = "0.1.5"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "1d6ea3c4595b96363c13943497db34af4460fb474a95c43f4446ad341b8c9785"
dependencies = [
 "toml",
]

[[package]]
name = "proc-macro-crate"
version = "1.3.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "7f4c021e1093a56626774e81216a4ce732a735e5bad4868a03f3ed65ca0c3919"
dependencies = [
 "once_cell",
 "toml_edit 0.19.15",
]

[[package]]
name = "proc-macro-crate"
version = "3.2.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "8ecf48c7ca261d60b74ab1a7b20da18bede46776b2e55535cb958eb595c5fa7b"
dependencies = [
 "toml_edit 0.22.20",
]

[[package]]
name = "proc-macro-error"
version = "1.0.4"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "da25490ff9892aab3fcf7c36f08cfb902dd3e71ca0f9f9517bea02a73a5ce38c"
dependencies = [
 "proc-macro-error-attr",
 "proc-macro2",
 "quote",
 "syn 1.0.109",
 "version_check",
]

[[package]]
name = "proc-macro-error-attr"
version = "1.0.4"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "a1be40180e52ecc98ad80b184934baf3d0d29f979574e439af5a55274b35f869"
dependencies = [
 "proc-macro2",
 "quote",
 "version_check",
]

[[package]]
name = "proc-macro-hack"
version = "0.5.20+deprecated"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "dc375e1527247fe1a97d8b7156678dfe7c1af2fc075c9a4db3690ecd2a148068"

[[package]]
name = "proc-macro2"
version = "1.0.86"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "5e719e8df665df0d1c8fbfd238015744736151d4445ec0836b8e628aae103b77"
dependencies = [
 "unicode-ident",
]

[[package]]
name = "prost"
version = "0.12.6"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "deb1435c188b76130da55f17a466d252ff7b1418b2ad3e037d127b94e3411f29"
dependencies = [
 "bytes",
 "prost-derive",
]

[[package]]
name = "prost-build"
version = "0.12.6"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "22505a5c94da8e3b7c2996394d1c933236c4d743e81a410bcca4e6989fc066a4"
dependencies = [
 "bytes",
 "heck 0.5.0",
 "itertools 0.12.1",
 "log",
 "multimap",
 "once_cell",
 "petgraph",
 "prettyplease",
 "prost",
 "prost-types",
 "regex",
 "syn 2.0.77",
 "tempfile",
]

[[package]]
name = "prost-derive"
version = "0.12.6"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "81bddcdb20abf9501610992b6759a4c888aef7d1a7247ef75e2404275ac24af1"
dependencies = [
 "anyhow",
 "itertools 0.12.1",
 "proc-macro2",
 "quote",
 "syn 2.0.77",
]

[[package]]
name = "prost-types"
version = "0.12.6"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "9091c90b0a32608e984ff2fa4091273cbdd755d54935c51d520887f4a1dbd5b0"
dependencies = [
 "prost",
]

[[package]]
name = "psm"
version = "0.1.23"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "aa37f80ca58604976033fae9515a8a2989fc13797d953f7c04fb8fa36a11f205"
dependencies = [
 "cc",
]

[[package]]
name = "ptr_meta"
version = "0.1.4"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "0738ccf7ea06b608c10564b31debd4f5bc5e197fc8bfe088f68ae5ce81e7a4f1"
dependencies = [
 "ptr_meta_derive",
]

[[package]]
name = "ptr_meta_derive"
version = "0.1.4"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "16b845dbfca988fa33db069c0e230574d15a3088f147a87b64c7589eb662c9ac"
dependencies = [
 "proc-macro2",
 "quote",
 "syn 1.0.109",
]

[[package]]
name = "quinn"
version = "0.11.5"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "8c7c5fdde3cdae7203427dc4f0a68fe0ed09833edc525a03456b153b79828684"
dependencies = [
 "bytes",
 "pin-project-lite",
 "quinn-proto",
 "quinn-udp",
 "rustc-hash 2.0.0",
 "rustls 0.23.13",
 "socket2 0.5.7",
 "thiserror",
 "tokio",
 "tracing",
]

[[package]]
name = "quinn-proto"
version = "0.11.8"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "fadfaed2cd7f389d0161bb73eeb07b7b78f8691047a6f3e73caaeae55310a4a6"
dependencies = [
 "bytes",
 "rand",
 "ring 0.17.8",
 "rustc-hash 2.0.0",
 "rustls 0.23.13",
 "slab",
 "thiserror",
 "tinyvec",
 "tracing",
]

[[package]]
name = "quinn-udp"
version = "0.5.5"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "4fe68c2e9e1a1234e218683dbdf9f9dfcb094113c5ac2b938dfcb9bab4c4140b"
dependencies = [
 "libc",
 "once_cell",
 "socket2 0.5.7",
 "tracing",
 "windows-sys 0.59.0",
]

[[package]]
name = "quote"
version = "1.0.37"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "b5b9d34b8991d19d98081b46eacdd8eb58c6f2b201139f7c5f643cc155a633af"
dependencies = [
 "proc-macro2",
]

[[package]]
name = "radium"
version = "0.7.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "dc33ff2d4973d518d823d61aa239014831e521c75da58e3df4840d3f47749d09"

[[package]]
name = "rand"
version = "0.8.5"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "34af8d1a0e25924bc5b7c43c079c942339d8f0a8b57c39049bef581b46327404"
dependencies = [
 "libc",
 "rand_chacha",
 "rand_core",
]

[[package]]
name = "rand_chacha"
version = "0.3.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "e6c10a63a0fa32252be49d21e7709d4d4baf8d231c2dbce1eaa8141b9b127d88"
dependencies = [
 "ppv-lite86",
 "rand_core",
]

[[package]]
name = "rand_core"
version = "0.6.4"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "ec0be4795e2f6a28069bec0b5ff3e2ac9bafc99e6a9a7dc3547996c5c816922c"
dependencies = [
 "getrandom",
]

[[package]]
name = "rangemap"
version = "1.5.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "f60fcc7d6849342eff22c4350c8b9a989ee8ceabc4b481253e8946b9fe83d684"

[[package]]
name = "redox_syscall"
version = "0.5.4"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "0884ad60e090bf1345b93da0a5de8923c93884cd03f40dfcfddd3b4bee661853"
dependencies = [
 "bitflags 2.6.0",
]

[[package]]
name = "redox_users"
version = "0.4.6"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "ba009ff324d1fc1b900bd1fdb31564febe58a8ccc8a6fdbb93b543d33b13ca43"
dependencies = [
 "getrandom",
 "libredox",
 "thiserror",
]

[[package]]
name = "regex"
version = "1.10.6"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "4219d74c6b67a3654a9fbebc4b419e22126d13d2f3c4a07ee0cb61ff79a79619"
dependencies = [
 "aho-corasick",
 "memchr",
 "regex-automata",
 "regex-syntax",
]

[[package]]
name = "regex-automata"
version = "0.4.7"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "38caf58cc5ef2fed281f89292ef23f6365465ed9a41b7a7754eb4e26496c92df"
dependencies = [
 "aho-corasick",
 "memchr",
 "regex-syntax",
]

[[package]]
name = "regex-syntax"
version = "0.8.4"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "7a66a03ae7c801facd77a29370b4faec201768915ac14a721ba36f20bc9c209b"

[[package]]
name = "rend"
version = "0.4.2"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "71fe3824f5629716b1589be05dacd749f6aa084c87e00e016714a8cdfccc997c"
dependencies = [
 "bytecheck",
]

[[package]]
name = "reqwest"
version = "0.11.27"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "dd67538700a17451e7cba03ac727fb961abb7607553461627b97de0b89cf4a62"
dependencies = [
 "base64 0.21.7",
 "bytes",
 "encoding_rs",
 "futures-core",
 "futures-util",
 "h2 0.3.26",
 "http 0.2.12",
 "http-body 0.4.6",
 "hyper 0.14.30",
 "hyper-rustls 0.24.2",
 "hyper-tls",
 "ipnet",
 "js-sys",
 "log",
 "mime",
 "native-tls",
 "once_cell",
 "percent-encoding",
 "pin-project-lite",
 "rustls 0.21.12",
 "rustls-pemfile 1.0.4",
 "serde",
 "serde_json",
 "serde_urlencoded",
 "sync_wrapper 0.1.2",
 "system-configuration",
 "tokio",
 "tokio-native-tls",
 "tokio-rustls 0.24.1",
 "tower-service",
 "url",
 "wasm-bindgen",
 "wasm-bindgen-futures",
 "web-sys",
 "webpki-roots 0.25.4",
 "winreg",
]

[[package]]
name = "reqwest"
version = "0.12.7"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "f8f4955649ef5c38cc7f9e8aa41761d48fb9677197daea9984dc54f56aad5e63"
dependencies = [
 "base64 0.22.1",
 "bytes",
 "futures-channel",
 "futures-core",
 "futures-util",
 "h2 0.4.6",
 "http 1.1.0",
 "http-body 1.0.1",
 "http-body-util",
 "hyper 1.4.1",
 "hyper-rustls 0.27.3",
 "hyper-util",
 "ipnet",
 "js-sys",
 "log",
 "mime",
 "mime_guess",
 "once_cell",
 "percent-encoding",
 "pin-project-lite",
 "quinn",
 "rustls 0.23.13",
 "rustls-native-certs 0.7.3",
 "rustls-pemfile 2.1.3",
 "rustls-pki-types",
 "serde",
 "serde_json",
 "serde_urlencoded",
 "sync_wrapper 1.0.1",
 "tokio",
 "tokio-rustls 0.26.0",
 "tokio-socks",
 "tokio-util",
 "tower-service",
 "url",
 "wasm-bindgen",
 "wasm-bindgen-futures",
 "wasm-streams",
 "web-sys",
 "webpki-roots 0.26.5",
 "windows-registry",
]

[[package]]
name = "rfc6979"
version = "0.3.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "7743f17af12fa0b03b803ba12cd6a8d9483a587e89c69445e3909655c0b9fabb"
dependencies = [
 "crypto-bigint 0.4.9",
 "hmac 0.12.1",
 "zeroize",
]

[[package]]
name = "rfc6979"
version = "0.4.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "f8dd2a808d456c4a54e300a23e9f5a67e122c3024119acbfd73e3bf664491cb2"
dependencies = [
 "hmac 0.12.1",
 "subtle",
]

[[package]]
name = "ring"
version = "0.16.20"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "3053cf52e236a3ed746dfc745aa9cacf1b791d846bdaf412f60a8d7d6e17c8fc"
dependencies = [
 "cc",
 "libc",
 "once_cell",
 "spin 0.5.2",
 "untrusted 0.7.1",
 "web-sys",
 "winapi",
]

[[package]]
name = "ring"
version = "0.17.8"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "c17fa4cb658e3583423e915b9f3acc01cceaee1860e33d59ebae66adc3a2dc0d"
dependencies = [
 "cc",
 "cfg-if",
 "getrandom",
 "libc",
 "spin 0.9.8",
 "untrusted 0.9.0",
 "windows-sys 0.52.0",
]

[[package]]
name = "ripemd"
version = "0.1.3"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "bd124222d17ad93a644ed9d011a40f4fb64aa54275c08cc216524a9ea82fb09f"
dependencies = [
 "digest 0.10.7",
]

[[package]]
name = "rkyv"
version = "0.7.45"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "9008cd6385b9e161d8229e1f6549dd23c3d022f132a2ea37ac3a10ac4935779b"
dependencies = [
 "bitvec",
 "bytecheck",
 "bytes",
 "hashbrown 0.12.3",
 "ptr_meta",
 "rend",
 "rkyv_derive",
 "seahash",
 "tinyvec",
 "uuid",
]

[[package]]
name = "rkyv_derive"
version = "0.7.45"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "503d1d27590a2b0a3a4ca4c94755aa2875657196ecbf401a42eff41d7de532c0"
dependencies = [
 "proc-macro2",
 "quote",
 "syn 1.0.109",
]

[[package]]
name = "rle-decode-fast"
version = "1.0.3"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "3582f63211428f83597b51b2ddb88e2a91a9d52d12831f9d08f5e624e8977422"

[[package]]
name = "rust_decimal"
version = "1.36.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "b082d80e3e3cc52b2ed634388d436fe1f4de6af5786cc2de9ba9737527bdf555"
dependencies = [
 "arrayvec 0.7.6",
 "borsh",
 "bytes",
 "num-traits",
 "rand",
 "rkyv",
 "serde",
 "serde_json",
]

[[package]]
name = "rust_decimal_macros"
version = "1.36.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "da991f231869f34268415a49724c6578e740ad697ba0999199d6f22b3949332c"
dependencies = [
 "quote",
 "rust_decimal",
]

[[package]]
name = "rustc-demangle"
version = "0.1.24"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "719b953e2095829ee67db738b3bfa9fa368c94900df327b3f07fe6e794d2fe1f"

[[package]]
name = "rustc-hash"
version = "1.1.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "08d43f7aa6b08d49f382cde6a7982047c3426db949b1424bc4b7ec9ae12c6ce2"

[[package]]
name = "rustc-hash"
version = "2.0.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "583034fd73374156e66797ed8e5b0d5690409c9226b22d87cb7f19821c05d152"

[[package]]
name = "rustc_version"
version = "0.4.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "cfcb3a22ef46e85b45de6ee7e79d063319ebb6594faafcf1c225ea92ab6e9b92"
dependencies = [
 "semver",
]

[[package]]
name = "rustix"
version = "0.37.27"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "fea8ca367a3a01fe35e6943c400addf443c0f57670e6ec51196f71a4b8762dd2"
dependencies = [
 "bitflags 1.3.2",
 "errno",
 "io-lifetimes",
 "libc",
 "linux-raw-sys 0.3.8",
 "windows-sys 0.48.0",
]

[[package]]
name = "rustix"
version = "0.38.37"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "8acb788b847c24f28525660c4d7758620a7210875711f79e7f663cc152726811"
dependencies = [
 "bitflags 2.6.0",
 "errno",
 "libc",
 "linux-raw-sys 0.4.14",
 "windows-sys 0.52.0",
]

[[package]]
name = "rustls"
version = "0.20.9"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "1b80e3dec595989ea8510028f30c408a4630db12c9cbb8de34203b89d6577e99"
dependencies = [
 "log",
 "ring 0.16.20",
 "sct",
 "webpki",
]

[[package]]
name = "rustls"
version = "0.21.12"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "3f56a14d1f48b391359b22f731fd4bd7e43c97f3c50eee276f3aa09c94784d3e"
dependencies = [
 "log",
 "ring 0.17.8",
 "rustls-webpki 0.101.7",
 "sct",
]

[[package]]
name = "rustls"
version = "0.23.13"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "f2dabaac7466917e566adb06783a81ca48944c6898a1b08b9374106dd671f4c8"
dependencies = [
 "once_cell",
 "ring 0.17.8",
 "rustls-pki-types",
 "rustls-webpki 0.102.8",
 "subtle",
 "zeroize",
]

[[package]]
name = "rustls-native-certs"
version = "0.6.3"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "a9aace74cb666635c918e9c12bc0d348266037aa8eb599b5cba565709a8dff00"
dependencies = [
 "openssl-probe",
 "rustls-pemfile 1.0.4",
 "schannel",
 "security-framework",
]

[[package]]
name = "rustls-native-certs"
version = "0.7.3"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "e5bfb394eeed242e909609f56089eecfe5fda225042e8b171791b9c95f5931e5"
dependencies = [
 "openssl-probe",
 "rustls-pemfile 2.1.3",
 "rustls-pki-types",
 "schannel",
 "security-framework",
]

[[package]]
name = "rustls-native-certs"
version = "0.8.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "fcaf18a4f2be7326cd874a5fa579fae794320a0f388d365dca7e480e55f83f8a"
dependencies = [
 "openssl-probe",
 "rustls-pemfile 2.1.3",
 "rustls-pki-types",
 "schannel",
 "security-framework",
]

[[package]]
name = "rustls-pemfile"
version = "1.0.4"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "1c74cae0a4cf6ccbbf5f359f08efdf8ee7e1dc532573bf0db71968cb56b1448c"
dependencies = [
 "base64 0.21.7",
]

[[package]]
name = "rustls-pemfile"
version = "2.1.3"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "196fe16b00e106300d3e45ecfcb764fa292a535d7326a29a5875c579c7417425"
dependencies = [
 "base64 0.22.1",
 "rustls-pki-types",
]

[[package]]
name = "rustls-pki-types"
version = "1.8.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "fc0a2ce646f8655401bb81e7927b812614bd5d91dbc968696be50603510fcaf0"

[[package]]
name = "rustls-webpki"
version = "0.101.7"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "8b6275d1ee7a1cd780b64aca7726599a1dbc893b1e64144529e55c3c2f745765"
dependencies = [
 "ring 0.17.8",
 "untrusted 0.9.0",
]

[[package]]
name = "rustls-webpki"
version = "0.102.8"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "64ca1bc8749bd4cf37b5ce386cc146580777b4e8572c7b97baf22c83f444bee9"
dependencies = [
 "ring 0.17.8",
 "rustls-pki-types",
 "untrusted 0.9.0",
]

[[package]]
name = "rustversion"
version = "1.0.17"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "955d28af4278de8121b7ebeb796b6a45735dc01436d898801014aced2773a3d6"

[[package]]
name = "ryu"
version = "1.0.18"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "f3cb5ba0dc43242ce17de99c180e96db90b235b8a9fdc9543c96d2209116bd9f"

[[package]]
name = "schannel"
version = "0.1.24"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "e9aaafd5a2b6e3d657ff009d82fbd630b6bd54dd4eb06f21693925cdf80f9b8b"
dependencies = [
 "windows-sys 0.59.0",
]

[[package]]
name = "schemars"
version = "0.8.21"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "09c024468a378b7e36765cd36702b7a90cc3cba11654f6685c8f233408e89e92"
dependencies = [
 "dyn-clone",
 "schemars_derive",
 "serde",
 "serde_json",
]

[[package]]
name = "schemars_derive"
version = "0.8.21"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "b1eee588578aff73f856ab961cd2f79e36bc45d7ded33a7562adba4667aecc0e"
dependencies = [
 "proc-macro2",
 "quote",
 "serde_derive_internals",
 "syn 2.0.77",
]

[[package]]
name = "scoped-tls"
version = "1.0.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "e1cf6437eb19a8f4a6cc0f7dca544973b0b78843adbfeb3683d1a94a0024a294"

[[package]]
name = "scoped_threadpool"
version = "0.1.9"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "1d51f5df5af43ab3f1360b429fa5e0152ac5ce8c0bd6485cae490332e96846a8"

[[package]]
name = "scopeguard"
version = "1.2.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "94143f37725109f92c262ed2cf5e59bce7498c01bcc1502d7b9afe439a4e9f49"

[[package]]
name = "sct"
version = "0.7.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "da046153aa2352493d6cb7da4b6e5c0c057d8a1d0a9aa8560baffdd945acd414"
dependencies = [
 "ring 0.17.8",
 "untrusted 0.9.0",
]

[[package]]
name = "seahash"
version = "4.1.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "1c107b6f4780854c8b126e228ea8869f4d7b71260f962fefb57b996b8959ba6b"

[[package]]
name = "sec1"
version = "0.3.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "3be24c1842290c45df0a7bf069e0c268a747ad05a192f2fd7dcfdbc1cba40928"
dependencies = [
 "base16ct 0.1.1",
 "der 0.6.1",
 "generic-array",
 "pkcs8 0.9.0",
 "subtle",
 "zeroize",
]

[[package]]
name = "sec1"
version = "0.7.3"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "d3e97a565f76233a6003f9f5c54be1d9c5bdfa3eccfb189469f11ec4901c47dc"
dependencies = [
 "base16ct 0.2.0",
 "der 0.7.9",
 "generic-array",
 "pkcs8 0.10.2",
 "subtle",
 "zeroize",
]

[[package]]
name = "secret-service"
version = "2.0.2"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "e1da5c423b8783185fd3fecd1c8796c267d2c089d894ce5a93c280a5d3f780a2"
dependencies = [
 "aes 0.7.5",
 "block-modes",
 "hkdf 0.11.0",
 "lazy_static",
 "num",
 "rand",
 "serde",
 "sha2 0.9.9",
 "zbus",
 "zbus_macros",
 "zvariant",
 "zvariant_derive",
]

[[package]]
name = "security-framework"
version = "2.11.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "897b2245f0b511c87893af39b033e5ca9cce68824c4d7e7630b5a1d339658d02"
dependencies = [
 "bitflags 2.6.0",
 "core-foundation",
 "core-foundation-sys",
 "libc",
 "security-framework-sys",
]

[[package]]
name = "security-framework-sys"
version = "2.11.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "75da29fe9b9b08fe9d6b22b5b4bcbc75d8db3aa31e639aa56bb62e9d46bfceaf"
dependencies = [
 "core-foundation-sys",
 "libc",
]

[[package]]
name = "semver"
version = "1.0.23"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "61697e0a1c7e512e84a621326239844a24d8207b4669b41bc18b32ea5cbf988b"
dependencies = [
 "serde",
]

[[package]]
name = "serde"
version = "1.0.210"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "c8e3592472072e6e22e0a54d5904d9febf8508f65fb8552499a1abc7d1078c3a"
dependencies = [
 "serde_derive",
]

[[package]]
name = "serde_bytes"
version = "0.11.15"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "387cc504cb06bb40a96c8e04e951fe01854cf6bc921053c954e4a606d9675c6a"
dependencies = [
 "serde",
]

[[package]]
name = "serde_cbor"
version = "0.11.2"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "2bef2ebfde456fb76bbcf9f59315333decc4fda0b2b44b420243c11e0f5ec1f5"
dependencies = [
 "half 1.8.3",
 "serde",
]

[[package]]
name = "serde_derive"
version = "1.0.210"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "243902eda00fad750862fc144cea25caca5e20d615af0a81bee94ca738f1df1f"
dependencies = [
 "proc-macro2",
 "quote",
 "syn 2.0.77",
]

[[package]]
name = "serde_derive_internals"
version = "0.29.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "18d26a20a969b9e3fdf2fc2d9f21eda6c40e2de84c9408bb5d3b05d499aae711"
dependencies = [
 "proc-macro2",
 "quote",
 "syn 2.0.77",
]

[[package]]
name = "serde_json"
version = "1.0.128"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "6ff5456707a1de34e7e37f2a6fd3d3f808c318259cbd01ab6377795054b483d8"
dependencies = [
 "itoa",
 "memchr",
 "ryu",
 "serde",
]

[[package]]
name = "serde_repr"
version = "0.1.19"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "6c64451ba24fc7a6a2d60fc75dd9c83c90903b19028d4eff35e88fc1e86564e9"
dependencies = [
 "proc-macro2",
 "quote",
 "syn 2.0.77",
]

[[package]]
name = "serde_tokenstream"
version = "0.1.7"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "797ba1d80299b264f3aac68ab5d12e5825a561749db4df7cd7c8083900c5d4e9"
dependencies = [
 "proc-macro2",
 "serde",
 "syn 1.0.109",
]

[[package]]
name = "serde_urlencoded"
version = "0.7.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "d3491c14715ca2294c4d6a88f15e84739788c1d030eed8c110436aafdaa2f3fd"
dependencies = [
 "form_urlencoded",
 "itoa",
 "ryu",
 "serde",
]

[[package]]
name = "serde_with"
version = "1.14.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "678b5a069e50bf00ecd22d0cd8ddf7c236f68581b03db652061ed5eb13a312ff"
dependencies = [
 "serde",
 "serde_with_macros",
]

[[package]]
name = "serde_with_macros"
version = "1.5.2"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "e182d6ec6f05393cc0e5ed1bf81ad6db3a8feedf8ee515ecdd369809bcce8082"
dependencies = [
 "darling 0.13.4",
 "proc-macro2",
 "quote",
 "syn 1.0.109",
]

[[package]]
name = "serde_yaml"
version = "0.9.34+deprecated"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "6a8b1a1a2ebf674015cc02edccce75287f1a0130d394307b36743c2f5d504b47"
dependencies = [
 "indexmap 2.5.0",
 "itoa",
 "ryu",
 "serde",
 "unsafe-libyaml",
]

[[package]]
name = "sha2"
version = "0.9.9"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "4d58a1e1bf39749807d89cf2d98ac2dfa0ff1cb3faa38fbb64dd88ac8013d800"
dependencies = [
 "block-buffer 0.9.0",
 "cfg-if",
 "cpufeatures",
 "digest 0.9.0",
 "opaque-debug",
]

[[package]]
name = "sha2"
version = "0.10.8"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "793db75ad2bcafc3ffa7c68b215fee268f537982cd901d132f89c6343f3a3dc8"
dependencies = [
 "cfg-if",
 "cpufeatures",
 "digest 0.10.7",
]

[[package]]
name = "sha3"
version = "0.10.8"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "75872d278a8f37ef87fa0ddbda7802605cb18344497949862c0d4dcb291eba60"
dependencies = [
 "digest 0.10.7",
 "keccak",
]

[[package]]
name = "shell-words"
version = "1.1.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "24188a676b6ae68c3b2cb3a01be17fbf7240ce009799bb56d5b1409051e78fde"

[[package]]
name = "shlex"
version = "1.3.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "0fda2ff0d084019ba4d7c6f371c95d8fd75ce3524c3cb8fb653a3023f6323e64"

[[package]]
name = "signal-hook-registry"
version = "1.4.2"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "a9e9e0b4211b72e7b8b6e85c807d36c212bdb33ea8587f7569562a84df5465b1"
dependencies = [
 "libc",
]

[[package]]
name = "signature"
version = "1.6.4"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "74233d3b3b2f6d4b006dc19dee745e73e2a6bfb6f93607cd3b02bd5b00797d7c"
dependencies = [
 "digest 0.10.7",
 "rand_core",
]

[[package]]
name = "signature"
version = "2.2.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "77549399552de45a898a580c1b41d445bf730df867cc44e6c0233bbc4b8329de"
dependencies = [
 "digest 0.10.7",
 "rand_core",
]

[[package]]
name = "simdutf8"
version = "0.1.4"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "f27f6278552951f1f2b8cf9da965d10969b2efdea95a6ec47987ab46edfe263a"

[[package]]
name = "simple_asn1"
version = "0.6.2"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "adc4e5204eb1910f40f9cfa375f6f05b68c3abac4b6fd879c8ff5e7ae8a0a085"
dependencies = [
 "num-bigint 0.4.6",
 "num-traits",
 "thiserror",
 "time",
]

[[package]]
name = "slab"
version = "0.4.9"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "8f92a496fb766b417c996b9c5e57daf2f7ad3b0bebe1ccfca4856390e3d3bb67"
dependencies = [
 "autocfg",
]

[[package]]
name = "slog"
version = "2.7.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "8347046d4ebd943127157b94d63abb990fcf729dc4e9978927fdf4ac3c998d06"
dependencies = [
 "erased-serde",
]

[[package]]
name = "slog-async"
version = "2.8.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "72c8038f898a2c79507940990f05386455b3a317d8f18d4caea7cbc3d5096b84"
dependencies = [
 "crossbeam-channel",
 "slog",
 "take_mut",
 "thread_local",
]

[[package]]
name = "slog-json"
version = "2.6.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "3e1e53f61af1e3c8b852eef0a9dee29008f55d6dd63794f3f12cef786cf0f219"
dependencies = [
 "erased-serde",
 "serde",
 "serde_json",
 "slog",
 "time",
]

[[package]]
name = "slog-scope"
version = "4.4.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "2f95a4b4c3274cd2869549da82b57ccc930859bdbf5bcea0424bc5f140b3c786"
dependencies = [
 "arc-swap",
 "lazy_static",
 "slog",
]

[[package]]
name = "slog-term"
version = "2.9.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "b6e022d0b998abfe5c3782c1f03551a596269450ccd677ea51c56f8b214610e8"
dependencies = [
 "is-terminal",
 "slog",
 "term",
 "thread_local",
 "time",
]

[[package]]
name = "slotmap"
version = "1.0.7"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "dbff4acf519f630b3a3ddcfaea6c06b42174d9a44bc70c620e9ed1649d58b82a"
dependencies = [
 "version_check",
]

[[package]]
name = "smallvec"
version = "1.13.2"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "3c5e1a9a646d36c3599cd173a41282daf47c44583ad367b8e6837255952e5c67"

[[package]]
name = "sns"
version = "0.4.5"
dependencies = [
 "anyhow",
 "candid",
 "clap 4.5.17",
 "dfx-core",
 "dfx-extensions-utils",
 "fn-error-context",
 "futures-util",
 "ic-agent 0.37.1 (registry+https://github.com/rust-lang/crates.io-index)",
 "ic-sns-cli",
 "serde_json",
 "slog",
 "tokio",
]

[[package]]
name = "socket2"
version = "0.4.10"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "9f7916fc008ca5542385b89a3d3ce689953c143e9304a9bf8beec1de48994c0d"
dependencies = [
 "libc",
 "winapi",
]

[[package]]
name = "socket2"
version = "0.5.7"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "ce305eb0b4296696835b71df73eb912e0f1ffd2556a501fcede6e0c50349191c"
dependencies = [
 "libc",
 "windows-sys 0.52.0",
]

[[package]]
name = "spin"
version = "0.5.2"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "6e63cff320ae2c57904679ba7cb63280a3dc4613885beafb148ee7bf9aa9042d"

[[package]]
name = "spin"
version = "0.9.8"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "6980e8d7511241f8acf4aebddbb1ff938df5eebe98691418c4468d0b72a96a67"

[[package]]
name = "spki"
version = "0.6.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "67cf02bbac7a337dc36e4f5a693db6c21e7863f45070f7064577eb4367a3212b"
dependencies = [
 "base64ct",
 "der 0.6.1",
]

[[package]]
name = "spki"
version = "0.7.3"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "d91ed6c858b01f942cd56b37a94b3e0a1798290327d1236e4d9cf4eaca44d29d"
dependencies = [
 "base64ct",
 "der 0.7.9",
]

[[package]]
name = "stable_deref_trait"
version = "1.2.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "a8f112729512f8e442d81f95a8a7ddf2b7c6b8a1a6f509a95864142b30cab2d3"

[[package]]
name = "stacker"
version = "0.1.17"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "799c883d55abdb5e98af1a7b3f23b9b6de8ecada0ecac058672d7635eb48ca7b"
dependencies = [
 "cc",
 "cfg-if",
 "libc",
 "psm",
 "windows-sys 0.59.0",
]

[[package]]
name = "static_assertions"
version = "1.1.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "a2eb9349b6444b326872e140eb1cf5e7c522154d69e7a0ffb0fb81c06b37543f"

[[package]]
name = "strsim"
version = "0.10.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "73473c0e59e6d5812c5dfe2a064a6444949f089e20eec9a2e5506596494e4623"

[[package]]
name = "strsim"
version = "0.11.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "7da8b5736845d9f2fcb837ea5d9e2628564b3b043a70948a3f0b778838c5fb4f"

[[package]]
name = "strum"
version = "0.26.3"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "8fec0f0aef304996cf250b31b5a10dee7980c85da9d759361292b8bca5a18f06"
dependencies = [
 "strum_macros",
]

[[package]]
name = "strum_macros"
version = "0.26.4"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "4c6bee85a5a24955dc440386795aa378cd9cf82acd5f764469152d2270e581be"
dependencies = [
 "heck 0.5.0",
 "proc-macro2",
 "quote",
 "rustversion",
 "syn 2.0.77",
]

[[package]]
name = "subtle"
version = "2.6.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "13c2bddecc57b384dee18652358fb23172facb8a2c51ccc10d74c157bdea3292"

[[package]]
name = "subtle-ng"
version = "2.5.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "734676eb262c623cec13c3155096e08d1f8f29adce39ba17948b18dad1e54142"

[[package]]
name = "syn"
version = "1.0.109"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "72b64191b275b66ffe2469e8af2c1cfe3bafa67b529ead792a6d0160888b4237"
dependencies = [
 "proc-macro2",
 "quote",
 "unicode-ident",
]

[[package]]
name = "syn"
version = "2.0.77"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "9f35bcdf61fd8e7be6caf75f429fdca8beb3ed76584befb503b1569faee373ed"
dependencies = [
 "proc-macro2",
 "quote",
 "unicode-ident",
]

[[package]]
name = "syn_derive"
version = "0.1.8"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "1329189c02ff984e9736652b1631330da25eaa6bc639089ed4915d25446cbe7b"
dependencies = [
 "proc-macro-error",
 "proc-macro2",
 "quote",
 "syn 2.0.77",
]

[[package]]
name = "sync_wrapper"
version = "0.1.2"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "2047c6ded9c721764247e62cd3b03c09ffc529b2ba5b10ec482ae507a4a70160"

[[package]]
name = "sync_wrapper"
version = "1.0.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "a7065abeca94b6a8a577f9bd45aa0867a2238b74e8eb67cf10d492bc39351394"
dependencies = [
 "futures-core",
]

[[package]]
name = "system-configuration"
version = "0.5.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "ba3a3adc5c275d719af8cb4272ea1c4a6d668a777f37e115f6d11ddbc1c8e0e7"
dependencies = [
 "bitflags 1.3.2",
 "core-foundation",
 "system-configuration-sys",
]

[[package]]
name = "system-configuration-sys"
version = "0.5.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "a75fb188eb626b924683e3b95e3a48e63551fcfb51949de2f06a9d91dbee93c9"
dependencies = [
 "core-foundation-sys",
 "libc",
]

[[package]]
name = "take_mut"
version = "0.2.2"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "f764005d11ee5f36500a149ace24e00e3da98b0158b3e2d53a7495660d3f4d60"

[[package]]
name = "tap"
version = "1.0.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "55937e1799185b12863d447f42597ed69d9928686b8d88a1df17376a097d8369"

[[package]]
name = "tar"
version = "0.4.39"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "ec96d2ffad078296368d46ff1cb309be1c23c513b4ab0e22a45de0185275ac96"
dependencies = [
 "filetime",
 "libc",
 "xattr",
]

[[package]]
name = "tempfile"
version = "3.12.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "04cbcdd0c794ebb0d4cf35e88edd2f7d2c4c3e9a5a6dab322839b321c6a87a64"
dependencies = [
 "cfg-if",
 "fastrand 2.1.1",
 "once_cell",
 "rustix 0.38.37",
 "windows-sys 0.59.0",
]

[[package]]
name = "term"
version = "0.7.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "c59df8ac95d96ff9bede18eb7300b0fda5e5d8d90960e76f8e14ae765eedbf1f"
dependencies = [
 "dirs-next",
 "rustversion",
 "winapi",
]

[[package]]
name = "termcolor"
version = "1.4.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "06794f8f6c5c898b3275aebefa6b8a1cb24cd2c6c79397ab15774837a0bc5755"
dependencies = [
 "winapi-util",
]

[[package]]
name = "termtree"
version = "0.4.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "3369f5ac52d5eb6ab48c6b4ffdc8efbcad6b89c765749064ba298f2c68a16a76"

[[package]]
name = "textwrap"
version = "0.16.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "23d434d3f8967a09480fb04132ebe0a3e088c173e6d0ee7897abbdf4eab0f8b9"

[[package]]
name = "thiserror"
version = "1.0.63"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "c0342370b38b6a11b6cc11d6a805569958d54cfa061a29969c3b5ce2ea405724"
dependencies = [
 "thiserror-impl",
]

[[package]]
name = "thiserror-impl"
version = "1.0.63"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "a4558b58466b9ad7ca0f102865eccc95938dca1a74a856f2b57b6629050da261"
dependencies = [
 "proc-macro2",
 "quote",
 "syn 2.0.77",
]

[[package]]
name = "thousands"
version = "0.2.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "3bf63baf9f5039dadc247375c29eb13706706cfde997d0330d05aa63a77d8820"

[[package]]
name = "thread_local"
version = "1.1.8"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "8b9ef9bad013ada3808854ceac7b46812a6465ba368859a37e2100283d2d719c"
dependencies = [
 "cfg-if",
 "once_cell",
]

[[package]]
name = "time"
version = "0.3.36"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "5dfd88e563464686c916c7e46e623e520ddc6d79fa6641390f2e3fa86e83e885"
dependencies = [
 "deranged",
 "itoa",
 "num-conv",
 "powerfmt",
 "serde",
 "time-core",
 "time-macros",
]

[[package]]
name = "time-core"
version = "0.1.2"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "ef927ca75afb808a4d64dd374f00a2adf8d0fcff8e7b184af886c3c87ec4a3f3"

[[package]]
name = "time-macros"
version = "0.2.18"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "3f252a68540fde3a3877aeea552b832b40ab9a69e318efd078774a01ddee1ccf"
dependencies = [
 "num-conv",
 "time-core",
]

[[package]]
name = "tiny-bip39"
version = "1.0.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "62cc94d358b5a1e84a5cb9109f559aa3c4d634d2b1b4de3d0fa4adc7c78e2861"
dependencies = [
 "anyhow",
 "hmac 0.12.1",
 "once_cell",
 "pbkdf2",
 "rand",
 "rustc-hash 1.1.0",
 "sha2 0.10.8",
 "thiserror",
 "unicode-normalization",
 "wasm-bindgen",
 "zeroize",
]

[[package]]
name = "tinyvec"
version = "1.8.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "445e881f4f6d382d5f27c034e25eb92edd7c784ceab92a0937db7f2e9471b938"
dependencies = [
 "tinyvec_macros",
]

[[package]]
name = "tinyvec_macros"
version = "0.1.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "1f3ccbac311fea05f86f61904b462b55fb3df8837a366dfc601a0161d0532f20"

[[package]]
name = "tokio"
version = "1.40.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "e2b070231665d27ad9ec9b8df639893f46727666c6767db40317fbe920a5d998"
dependencies = [
 "backtrace",
 "bytes",
 "libc",
 "mio",
 "parking_lot",
 "pin-project-lite",
 "signal-hook-registry",
 "socket2 0.5.7",
 "tokio-macros",
 "windows-sys 0.52.0",
]

[[package]]
name = "tokio-macros"
version = "2.4.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "693d596312e88961bc67d7f1f97af8a70227d9f90c31bba5806eec004978d752"
dependencies = [
 "proc-macro2",
 "quote",
 "syn 2.0.77",
]

[[package]]
name = "tokio-native-tls"
version = "0.3.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "bbae76ab933c85776efabc971569dd6119c580d8f5d448769dec1764bf796ef2"
dependencies = [
 "native-tls",
 "tokio",
]

[[package]]
name = "tokio-rustls"
version = "0.23.4"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "c43ee83903113e03984cb9e5cebe6c04a5116269e900e3ddba8f068a62adda59"
dependencies = [
 "rustls 0.20.9",
 "tokio",
 "webpki",
]

[[package]]
name = "tokio-rustls"
version = "0.24.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "c28327cf380ac148141087fbfb9de9d7bd4e84ab5d2c28fbc911d753de8a7081"
dependencies = [
 "rustls 0.21.12",
 "tokio",
]

[[package]]
name = "tokio-rustls"
version = "0.26.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "0c7bc40d0e5a97695bb96e27995cd3a08538541b0a846f65bba7a359f36700d4"
dependencies = [
 "rustls 0.23.13",
 "rustls-pki-types",
 "tokio",
]

[[package]]
name = "tokio-socks"
version = "0.5.2"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "0d4770b8024672c1101b3f6733eab95b18007dbe0847a8afe341fcf79e06043f"
dependencies = [
 "either",
 "futures-util",
 "thiserror",
 "tokio",
]

[[package]]
name = "tokio-util"
version = "0.7.12"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "61e7c3654c13bcd040d4a03abee2c75b1d14a37b423cf5a813ceae1cc903ec6a"
dependencies = [
 "bytes",
 "futures-core",
 "futures-sink",
 "pin-project-lite",
 "tokio",
]

[[package]]
name = "toml"
version = "0.5.11"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "f4f7f0dd8d50a853a531c426359045b1998f04219d88799810762cd4ad314234"
dependencies = [
 "serde",
]

[[package]]
name = "toml_datetime"
version = "0.6.8"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "0dd7358ecb8fc2f8d014bf86f6f638ce72ba252a2c3a2572f2a795f1d23efb41"

[[package]]
name = "toml_edit"
version = "0.19.15"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "1b5bb770da30e5cbfde35a2d7b9b8a2c4b8ef89548a7a6aeab5c9a576e3e7421"
dependencies = [
 "indexmap 2.5.0",
 "toml_datetime",
 "winnow 0.5.40",
]

[[package]]
name = "toml_edit"
version = "0.22.20"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "583c44c02ad26b0c3f3066fe629275e50627026c51ac2e595cca4c230ce1ce1d"
dependencies = [
 "indexmap 2.5.0",
 "toml_datetime",
 "winnow 0.6.18",
]

[[package]]
name = "tower"
version = "0.4.13"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "b8fa9be0de6cf49e536ce1851f987bd21a43b771b09473c3549a6c853db37c1c"
dependencies = [
 "futures-core",
 "futures-util",
 "pin-project",
 "pin-project-lite",
 "tokio",
 "tower-layer",
 "tower-service",
 "tracing",
]

[[package]]
name = "tower-layer"
version = "0.3.3"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "121c2a6cda46980bb0fcd1647ffaf6cd3fc79a013de288782836f6df9c48780e"

[[package]]
name = "tower-service"
version = "0.3.3"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "8df9b6e13f2d32c91b9bd719c00d1958837bc7dec474d94952798cc8e69eeec3"

[[package]]
name = "tracing"
version = "0.1.40"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "c3523ab5a71916ccf420eebdf5521fcef02141234bbc0b8a49f2fdc4544364ef"
dependencies = [
 "log",
 "pin-project-lite",
 "tracing-core",
]

[[package]]
name = "tracing-core"
version = "0.1.32"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "c06d3da6113f116aaee68e4d601191614c9053067f9ab7f6edbcb161237daa54"
dependencies = [
 "once_cell",
]

[[package]]
name = "treediff"
version = "3.0.2"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "761e8d5ad7ce14bb82b7e61ccc0ca961005a275a060b9644a2431aa11553c2ff"
dependencies = [
 "serde_json",
]

[[package]]
name = "try-lock"
version = "0.2.5"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "e421abadd41a4225275504ea4d6566923418b7f05506fbc9c0fe86ba7396114b"

[[package]]
name = "typed-arena"
version = "2.0.2"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "6af6ae20167a9ece4bcb41af5b80f8a1f1df981f6391189ce00fd257af04126a"

[[package]]
name = "typenum"
version = "1.17.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "42ff0bf0c66b8238c6f3b578df37d0b7848e55df8577b3f74f92a69acceeb825"

[[package]]
name = "ucd-trie"
version = "0.1.6"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "ed646292ffc8188ef8ea4d1e0e0150fb15a5c2e12ad9b8fc191ae7a8a7f3c4b9"

[[package]]
name = "unicase"
version = "2.7.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "f7d2d4dafb69621809a81864c9c1b864479e1235c0dd4e199924b9742439ed89"
dependencies = [
 "version_check",
]

[[package]]
name = "unicode-bidi"
version = "0.3.15"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "08f95100a766bf4f8f28f90d77e0a5461bbdb219042e7679bebe79004fed8d75"

[[package]]
name = "unicode-ident"
version = "1.0.13"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "e91b56cd4cadaeb79bbf1a5645f6b4f8dc5bde8834ad5894a8db35fda9efa1fe"

[[package]]
name = "unicode-normalization"
version = "0.1.23"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "a56d1686db2308d901306f92a263857ef59ea39678a5458e7cb17f01415101f5"
dependencies = [
 "tinyvec",
]

[[package]]
name = "unicode-segmentation"
version = "1.11.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "d4c87d22b6e3f4a18d4d40ef354e97c90fcb14dd91d7dc0aa9d8a1172ebf7202"

[[package]]
name = "unicode-width"
version = "0.1.13"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "0336d538f7abc86d282a4189614dfaa90810dfc2c6f6427eaf88e16311dd225d"

[[package]]
name = "universal-hash"
version = "0.5.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "fc1de2c688dc15305988b563c3854064043356019f97a4b46276fe734c4f07ea"
dependencies = [
 "crypto-common",
 "subtle",
]

[[package]]
name = "unsafe-libyaml"
version = "0.2.11"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "673aac59facbab8a9007c7f6108d11f63b603f7cabff99fabf650fea5c32b861"

[[package]]
name = "untrusted"
version = "0.7.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "a156c684c91ea7d62626509bce3cb4e1d9ed5c4d978f7b4352658f96a4c26b4a"

[[package]]
name = "untrusted"
version = "0.9.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "8ecb6da28b8a351d773b68d5825ac39017e680750f980f3a1a85cd8dd28a47c1"

[[package]]
name = "url"
version = "2.5.2"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "22784dbdf76fdde8af1aeda5622b546b422b6fc585325248a2bf9f5e41e94d6c"
dependencies = [
 "form_urlencoded",
 "idna",
 "percent-encoding",
 "serde",
]

[[package]]
name = "utf8-width"
version = "0.1.7"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "86bd8d4e895da8537e5315b8254664e6b769c4ff3db18321b297a1e7004392e3"

[[package]]
name = "utf8parse"
version = "0.2.2"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "06abde3611657adf66d383f00b093d7faecc7fa57071cce2578660c9f1010821"

[[package]]
name = "uuid"
version = "1.10.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "81dfa00651efa65069b0b6b651f4aaa31ba9e3c3ce0137aaad053604ee7e0314"

[[package]]
name = "vcpkg"
version = "0.2.15"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "accd4ea62f7bb7a82fe23066fb0957d48ef677f6eeb8215f372f52e48bb32426"

[[package]]
name = "version_check"
version = "0.9.5"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "0b928f33d975fc6ad9f86c8f283853ad26bdd5b10b7f1542aa2fa15e2289105a"

[[package]]
name = "waker-fn"
version = "1.2.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "317211a0dc0ceedd78fb2ca9a44aed3d7b9b26f81870d485c07122b4350673b7"

[[package]]
name = "walrus"
version = "0.21.2"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "160c3708e3ad718ab4d84bec8de8c3d3450cd2902bd6c3ee3bbf50ad7529c2ad"
dependencies = [
 "anyhow",
 "gimli 0.26.2",
 "id-arena",
 "leb128",
 "log",
 "walrus-macro",
 "wasm-encoder",
 "wasmparser",
]

[[package]]
name = "walrus-macro"
version = "0.19.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "0a6e5bd22c71e77d60140b0bd5be56155a37e5bd14e24f5f87298040d0cc40d7"
dependencies = [
 "heck 0.3.3",
 "proc-macro2",
 "quote",
 "syn 1.0.109",
]

[[package]]
name = "want"
version = "0.3.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "bfa7760aed19e106de2c7c0b581b509f2f25d3dacaf737cb82ac61bc6d760b0e"
dependencies = [
 "try-lock",
]

[[package]]
name = "wasi"
version = "0.11.0+wasi-snapshot-preview1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "9c8d87e72b64a3b4db28d11ce29237c246188f4f51057d65a7eab63b7987e423"

[[package]]
name = "wasm-bindgen"
version = "0.2.93"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "a82edfc16a6c469f5f44dc7b571814045d60404b55a0ee849f9bcfa2e63dd9b5"
dependencies = [
 "cfg-if",
 "once_cell",
 "wasm-bindgen-macro",
]

[[package]]
name = "wasm-bindgen-backend"
version = "0.2.93"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "9de396da306523044d3302746f1208fa71d7532227f15e347e2d93e4145dd77b"
dependencies = [
 "bumpalo",
 "log",
 "once_cell",
 "proc-macro2",
 "quote",
 "syn 2.0.77",
 "wasm-bindgen-shared",
]

[[package]]
name = "wasm-bindgen-futures"
version = "0.4.43"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "61e9300f63a621e96ed275155c108eb6f843b6a26d053f122ab69724559dc8ed"
dependencies = [
 "cfg-if",
 "js-sys",
 "wasm-bindgen",
 "web-sys",
]

[[package]]
name = "wasm-bindgen-macro"
version = "0.2.93"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "585c4c91a46b072c92e908d99cb1dcdf95c5218eeb6f3bf1efa991ee7a68cccf"
dependencies = [
 "quote",
 "wasm-bindgen-macro-support",
]

[[package]]
name = "wasm-bindgen-macro-support"
version = "0.2.93"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "afc340c74d9005395cf9dd098506f7f44e38f2b4a21c6aaacf9a105ea5e1e836"
dependencies = [
 "proc-macro2",
 "quote",
 "syn 2.0.77",
 "wasm-bindgen-backend",
 "wasm-bindgen-shared",
]

[[package]]
name = "wasm-bindgen-shared"
version = "0.2.93"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "c62a0a307cb4a311d3a07867860911ca130c3494e8c2719593806c08bc5d0484"

[[package]]
name = "wasm-encoder"
version = "0.212.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "501940df4418b8929eb6d52f1aade1fdd15a5b86c92453cb696e3c906bd3fc33"
dependencies = [
 "leb128",
]

[[package]]
name = "wasm-streams"
version = "0.4.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "b65dc4c90b63b118468cf747d8bf3566c1913ef60be765b5730ead9e0a3ba129"
dependencies = [
 "futures-util",
 "js-sys",
 "wasm-bindgen",
 "wasm-bindgen-futures",
 "web-sys",
]

[[package]]
name = "wasmparser"
version = "0.212.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "8d28bc49ba1e5c5b61ffa7a2eace10820443c4b7d1c0b144109261d14570fdf8"
dependencies = [
 "ahash 0.8.11",
 "bitflags 2.6.0",
 "hashbrown 0.14.5",
 "indexmap 2.5.0",
 "semver",
 "serde",
]

[[package]]
name = "web-sys"
version = "0.3.70"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "26fdeaafd9bd129f65e7c031593c24d62186301e0c72c8978fa1678be7d532c0"
dependencies = [
 "js-sys",
 "wasm-bindgen",
]

[[package]]
name = "webpki"
version = "0.22.4"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "ed63aea5ce73d0ff405984102c42de94fc55a6b75765d621c65262469b3c9b53"
dependencies = [
 "ring 0.17.8",
 "untrusted 0.9.0",
]

[[package]]
name = "webpki-roots"
version = "0.22.6"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "b6c71e40d7d2c34a5106301fb632274ca37242cd0c9d3e64dbece371a40a2d87"
dependencies = [
 "webpki",
]

[[package]]
name = "webpki-roots"
version = "0.25.4"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "5f20c57d8d7db6d3b86154206ae5d8fba62dd39573114de97c2cb0578251f8e1"

[[package]]
name = "webpki-roots"
version = "0.26.5"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "0bd24728e5af82c6c4ec1b66ac4844bdf8156257fccda846ec58b42cd0cdbe6a"
dependencies = [
 "rustls-pki-types",
]

[[package]]
name = "winapi"
version = "0.3.9"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "5c839a674fcd7a98952e593242ea400abe93992746761e38641405d28b00f419"
dependencies = [
 "winapi-i686-pc-windows-gnu",
 "winapi-x86_64-pc-windows-gnu",
]

[[package]]
name = "winapi-i686-pc-windows-gnu"
version = "0.4.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "ac3b87c63620426dd9b991e5ce0329eff545bccbbb34f3be09ff6fb6ab51b7b6"

[[package]]
name = "winapi-util"
version = "0.1.9"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "cf221c93e13a30d793f7645a0e7762c55d169dbb0a49671918a2319d289b10bb"
dependencies = [
 "windows-sys 0.59.0",
]

[[package]]
name = "winapi-x86_64-pc-windows-gnu"
version = "0.4.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "712e227841d057c1ee1cd2fb22fa7e5a5461ae8e48fa2ca79ec42cfc1931183f"

[[package]]
name = "windows-core"
version = "0.52.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "33ab640c8d7e35bf8ba19b884ba838ceb4fba93a4e8c65a9059d08afcfc683d9"
dependencies = [
 "windows-targets 0.52.6",
]

[[package]]
name = "windows-registry"
version = "0.2.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "e400001bb720a623c1c69032f8e3e4cf09984deec740f007dd2b03ec864804b0"
dependencies = [
 "windows-result",
 "windows-strings",
 "windows-targets 0.52.6",
]

[[package]]
name = "windows-result"
version = "0.2.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "1d1043d8214f791817bab27572aaa8af63732e11bf84aa21a45a78d6c317ae0e"
dependencies = [
 "windows-targets 0.52.6",
]

[[package]]
name = "windows-strings"
version = "0.1.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "4cd9b125c486025df0eabcb585e62173c6c9eddcec5d117d3b6e8c30e2ee4d10"
dependencies = [
 "windows-result",
 "windows-targets 0.52.6",
]

[[package]]
name = "windows-sys"
version = "0.48.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "677d2418bec65e3338edb076e806bc1ec15693c5d0104683f2efe857f61056a9"
dependencies = [
 "windows-targets 0.48.5",
]

[[package]]
name = "windows-sys"
version = "0.52.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "282be5f36a8ce781fad8c8ae18fa3f9beff57ec1b52cb3de0789201425d9a33d"
dependencies = [
 "windows-targets 0.52.6",
]

[[package]]
name = "windows-sys"
version = "0.59.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "1e38bc4d79ed67fd075bcc251a1c39b32a1776bbe92e5bef1f0bf1f8c531853b"
dependencies = [
 "windows-targets 0.52.6",
]

[[package]]
name = "windows-targets"
version = "0.48.5"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "9a2fa6e2155d7247be68c096456083145c183cbbbc2764150dda45a87197940c"
dependencies = [
 "windows_aarch64_gnullvm 0.48.5",
 "windows_aarch64_msvc 0.48.5",
 "windows_i686_gnu 0.48.5",
 "windows_i686_msvc 0.48.5",
 "windows_x86_64_gnu 0.48.5",
 "windows_x86_64_gnullvm 0.48.5",
 "windows_x86_64_msvc 0.48.5",
]

[[package]]
name = "windows-targets"
version = "0.52.6"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "9b724f72796e036ab90c1021d4780d4d3d648aca59e491e6b98e725b84e99973"
dependencies = [
 "windows_aarch64_gnullvm 0.52.6",
 "windows_aarch64_msvc 0.52.6",
 "windows_i686_gnu 0.52.6",
 "windows_i686_gnullvm",
 "windows_i686_msvc 0.52.6",
 "windows_x86_64_gnu 0.52.6",
 "windows_x86_64_gnullvm 0.52.6",
 "windows_x86_64_msvc 0.52.6",
]

[[package]]
name = "windows_aarch64_gnullvm"
version = "0.48.5"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "2b38e32f0abccf9987a4e3079dfb67dcd799fb61361e53e2882c3cbaf0d905d8"

[[package]]
name = "windows_aarch64_gnullvm"
version = "0.52.6"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "32a4622180e7a0ec044bb555404c800bc9fd9ec262ec147edd5989ccd0c02cd3"

[[package]]
name = "windows_aarch64_msvc"
version = "0.48.5"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "dc35310971f3b2dbbf3f0690a219f40e2d9afcf64f9ab7cc1be722937c26b4bc"

[[package]]
name = "windows_aarch64_msvc"
version = "0.52.6"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "09ec2a7bb152e2252b53fa7803150007879548bc709c039df7627cabbd05d469"

[[package]]
name = "windows_i686_gnu"
version = "0.48.5"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "a75915e7def60c94dcef72200b9a8e58e5091744960da64ec734a6c6e9b3743e"

[[package]]
name = "windows_i686_gnu"
version = "0.52.6"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "8e9b5ad5ab802e97eb8e295ac6720e509ee4c243f69d781394014ebfe8bbfa0b"

[[package]]
name = "windows_i686_gnullvm"
version = "0.52.6"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "0eee52d38c090b3caa76c563b86c3a4bd71ef1a819287c19d586d7334ae8ed66"

[[package]]
name = "windows_i686_msvc"
version = "0.48.5"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "8f55c233f70c4b27f66c523580f78f1004e8b5a8b659e05a4eb49d4166cca406"

[[package]]
name = "windows_i686_msvc"
version = "0.52.6"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "240948bc05c5e7c6dabba28bf89d89ffce3e303022809e73deaefe4f6ec56c66"

[[package]]
name = "windows_x86_64_gnu"
version = "0.48.5"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "53d40abd2583d23e4718fddf1ebec84dbff8381c07cae67ff7768bbf19c6718e"

[[package]]
name = "windows_x86_64_gnu"
version = "0.52.6"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "147a5c80aabfbf0c7d901cb5895d1de30ef2907eb21fbbab29ca94c5b08b1a78"

[[package]]
name = "windows_x86_64_gnullvm"
version = "0.48.5"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "0b7b52767868a23d5bab768e390dc5f5c55825b6d30b86c844ff2dc7414044cc"

[[package]]
name = "windows_x86_64_gnullvm"
version = "0.52.6"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "24d5b23dc417412679681396f2b49f3de8c1473deb516bd34410872eff51ed0d"

[[package]]
name = "windows_x86_64_msvc"
version = "0.48.5"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "ed94fce61571a4006852b7389a063ab983c02eb1bb37b47f8272ce92d06d9538"

[[package]]
name = "windows_x86_64_msvc"
version = "0.52.6"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "589f6da84c646204747d1270a2a5661ea66ed1cced2631d546fdfb155959f9ec"

[[package]]
name = "winnow"
version = "0.5.40"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "f593a95398737aeed53e489c785df13f3618e41dbcd6718c6addbf1395aa6876"
dependencies = [
 "memchr",
]

[[package]]
name = "winnow"
version = "0.6.18"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "68a9bda4691f099d435ad181000724da8e5899daa10713c2d432552b9ccd3a6f"
dependencies = [
 "memchr",
]

[[package]]
name = "winreg"
version = "0.50.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "524e57b2c537c0f9b1e69f1965311ec12182b4122e45035b1508cd24d2adadb1"
dependencies = [
 "cfg-if",
 "windows-sys 0.48.0",
]

[[package]]
name = "wsl"
version = "0.1.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "f8dab7ac864710bdea6594becbea5b5050333cf34fefb0dc319567eb347950d4"

[[package]]
name = "wyz"
version = "0.5.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "05f360fc0b24296329c78fda852a1e9ae82de9cf7b27dae4b7f62f118f77b9ed"
dependencies = [
 "tap",
]

[[package]]
name = "xattr"
version = "0.2.3"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "6d1526bbe5aaeb5eb06885f4d987bcdfa5e23187055de9b83fe00156a821fabc"
dependencies = [
 "libc",
]

[[package]]
name = "xz2"
version = "0.1.7"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "388c44dc09d76f1536602ead6d325eb532f5c122f17782bd57fb47baeeb767e2"
dependencies = [
 "lzma-sys",
]

[[package]]
name = "yansi"
version = "0.5.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "09041cd90cf85f7f8b2df60c646f853b7f535ce68f85244eb6731cf89fa498ec"

[[package]]
name = "zbus"
version = "1.9.3"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "9cbeb2291cd7267a94489b71376eda33496c1b9881adf6b36f26cc2779f3fc49"
dependencies = [
 "async-io",
 "byteorder",
 "derivative",
 "enumflags2",
 "fastrand 1.9.0",
 "futures",
 "nb-connect",
 "nix 0.22.3",
 "once_cell",
 "polling",
 "scoped-tls",
 "serde",
 "serde_repr",
 "zbus_macros",
 "zvariant",
]

[[package]]
name = "zbus_macros"
version = "1.9.3"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "fa3959a7847cf95e3d51e312856617c5b1b77191176c65a79a5f14d778bbe0a6"
dependencies = [
 "proc-macro-crate 0.1.5",
 "proc-macro2",
 "quote",
 "syn 1.0.109",
]

[[package]]
name = "zerocopy"
version = "0.7.35"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "1b9b4fd18abc82b8136838da5d50bae7bdea537c574d8dc1a34ed098d6c166f0"
dependencies = [
 "byteorder",
 "zerocopy-derive",
]

[[package]]
name = "zerocopy-derive"
version = "0.7.35"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "fa4f8080344d4671fb4e831a13ad1e68092748387dfc4f55e356242fae12ce3e"
dependencies = [
 "proc-macro2",
 "quote",
 "syn 2.0.77",
]

[[package]]
name = "zeroize"
version = "1.8.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "ced3678a2879b30306d323f4542626697a464a97c0a07c9aebf7ebca65cd4dde"
dependencies = [
 "zeroize_derive",
]

[[package]]
name = "zeroize_derive"
version = "1.4.2"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "ce36e65b0d2999d2aafac989fb249189a141aee1f53c612c1f37d72631959f69"
dependencies = [
 "proc-macro2",
 "quote",
 "syn 2.0.77",
]

[[package]]
name = "zstd"
version = "0.13.2"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "fcf2b778a664581e31e389454a7072dab1647606d44f7feea22cd5abb9c9f3f9"
dependencies = [
 "zstd-safe",
]

[[package]]
name = "zstd-safe"
version = "7.2.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "54a3ab4db68cea366acc5c897c7b4d4d1b8994a9cd6e6f841f8964566a419059"
dependencies = [
 "zstd-sys",
]

[[package]]
name = "zstd-sys"
version = "2.0.13+zstd.1.5.6"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "38ff0f21cfee8f97d94cef41359e0c89aa6113028ab0291aa8ca0038995a95aa"
dependencies = [
 "cc",
 "pkg-config",
]

[[package]]
name = "zvariant"
version = "2.10.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "a68c7b55f2074489b7e8e07d2d0a6ee6b4f233867a653c664d8020ba53692525"
dependencies = [
 "byteorder",
 "enumflags2",
 "libc",
 "serde",
 "static_assertions",
 "zvariant_derive",
]

[[package]]
name = "zvariant_derive"
version = "2.10.0"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "e4ca5e22593eb4212382d60d26350065bf2a02c34b85bc850474a74b589a3de9"
dependencies = [
 "proc-macro-crate 1.3.1",
 "proc-macro2",
 "quote",
 "syn 1.0.109",
]


-----------------------

/Cargo.toml:
-----------------------

[workspace]
members = ["extensions/sns", "extensions/nns", "extensions-utils"]
resolver = "2"

[workspace.package]
authors = ["DFINITY Team"]
publish = false
edition = "2021"
license = "Apache-2.0"
repository = "https://github.com/dfinity/dfx-extensions"

[workspace.dependencies]
dfx-core = { git = "https://github.com/dfinity/sdk", rev = "993ae6df38caef8aae5291570b78954334d16b21" }
dfx-extensions-utils.path = "./extensions-utils"

anyhow = "^1"
candid = "0.10"
clap = { version = "4.2.1", features = ["derive", "env"] }
flate2 = { version = "1.0.25", default-features = false, features = [
    "zlib-ng",
] }
fn-error-context = "0.2.1"
futures-util = "0.3.28"
ic-agent = { git = "https://github.com/dfinity/agent-rs", rev = "6e11a350112f9b907c4d590d8217f340e153d898" }
ic-utils = { git = "https://github.com/dfinity/agent-rs", rev = "6e11a350112f9b907c4d590d8217f340e153d898" }
reqwest = { version = "^0.11.22", default-features = false, features = [
    "blocking",
    "json",
    "rustls-tls",
    "native-tls-vendored",
] }
serde = "^1.0"
slog = "^2.7.0"
tempfile = "3.12.0"
tokio = { version = "^1.36.0", features = ["rt-multi-thread"] }
url = "^2.4.1"
ic-http-utils = { git = "https://github.com/dfinity/ic", rev = "f7e561c00a2745f946372f5166fd7968fa664f53" }
ic-icp-index = { git = "https://github.com/dfinity/ic", rev = "f7e561c00a2745f946372f5166fd7968fa664f53" }
ic-icrc1-index-ng = { git = "https://github.com/dfinity/ic", rev = "f7e561c00a2745f946372f5166fd7968fa664f53" }
ic-icrc1-ledger = { git = "https://github.com/dfinity/ic", rev = "f7e561c00a2745f946372f5166fd7968fa664f53" }
ic-sns-cli = { git = "https://github.com/dfinity/ic", rev = "f7e561c00a2745f946372f5166fd7968fa664f53" }
serde_json = "1.0.79"

# Config for 'cargo dist'
[workspace.metadata.dist]
# CI backends to support
ci = ["github"]
# Target platforms to build apps for (Rust target-triple syntax)
targets = [
    "aarch64-apple-darwin",
    "x86_64-apple-darwin",
    "x86_64-unknown-linux-gnu",
]
# The archive format to use for non-windows builds (defaults .tar.xz)
unix-archive = ".tar.gz"
# Checksums to generate for each App
checksum = "sha256"
# Whether to consider the binaries in a package for distribution (defaults true)
dist = true
# The preferred cargo-dist version to use in CI (Cargo.toml SemVer syntax)
cargo-dist-version = "0.10.0"
# The installers to generate for each app
installers = []
# Publish jobs to run in CI
pr-run-mode = "skip"


# The profile that 'cargo dist' will build with
[profile.dist]
inherits = "release"
lto = "thin"


-----------------------

/LICENSE:
-----------------------

                                 Apache License
                           Version 2.0, January 2004
                        http://www.apache.org/licenses/

   TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION

   1. Definitions.

      "License" shall mean the terms and conditions for use, reproduction,
      and distribution as defined by Sections 1 through 9 of this document.

      "Licensor" shall mean the copyright owner or entity authorized by
      the copyright owner that is granting the License.

      "Legal Entity" shall mean the union of the acting entity and all
      other entities that control, are controlled by, or are under common
      control with that entity. For the purposes of this definition,
      "control" means (i) the power, direct or indirect, to cause the
      direction or management of such entity, whether by contract or
      otherwise, or (ii) ownership of fifty percent (50%) or more of the
      outstanding shares, or (iii) beneficial ownership of such entity.

      "You" (or "Your") shall mean an individual or Legal Entity
      exercising permissions granted by this License.

      "Source" form shall mean the preferred form for making modifications,
      including but not limited to software source code, documentation
      source, and configuration files.

      "Object" form shall mean any form resulting from mechanical
      transformation or translation of a Source form, including but
      not limited to compiled object code, generated documentation,
      and conversions to other media types.

      "Work" shall mean the work of authorship, whether in Source or
      Object form, made available under the License, as indicated by a
      copyright notice that is included in or attached to the work
      (an example is provided in the Appendix below).

      "Derivative Works" shall mean any work, whether in Source or Object
      form, that is based on (or derived from) the Work and for which the
      editorial revisions, annotations, elaborations, or other modifications
      represent, as a whole, an original work of authorship. For the purposes
      of this License, Derivative Works shall not include works that remain
      separable from, or merely link (or bind by name) to the interfaces of,
      the Work and Derivative Works thereof.

      "Contribution" shall mean any work of authorship, including
      the original version of the Work and any modifications or additions
      to that Work or Derivative Works thereof, that is intentionally
      submitted to Licensor for inclusion in the Work by the copyright owner
      or by an individual or Legal Entity authorized to submit on behalf of
      the copyright owner. For the purposes of this definition, "submitted"
      means any form of electronic, verbal, or written communication sent
      to the Licensor or its representatives, including but not limited to
      communication on electronic mailing lists, source code control systems,
      and issue tracking systems that are managed by, or on behalf of, the
      Licensor for the purpose of discussing and improving the Work, but
      excluding communication that is conspicuously marked or otherwise
      designated in writing by the copyright owner as "Not a Contribution."

      "Contributor" shall mean Licensor and any individual or Legal Entity
      on behalf of whom a Contribution has been received by Licensor and
      subsequently incorporated within the Work.

   2. Grant of Copyright License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
      copyright license to reproduce, prepare Derivative Works of,
      publicly display, publicly perform, sublicense, and distribute the
      Work and such Derivative Works in Source or Object form.

   3. Grant of Patent License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
      (except as stated in this section) patent license to make, have made,
      use, offer to sell, sell, import, and otherwise transfer the Work,
      where such license applies only to those patent claims licensable
      by such Contributor that are necessarily infringed by their
      Contribution(s) alone or by combination of their Contribution(s)
      with the Work to which such Contribution(s) was submitted. If You
      institute patent litigation against any entity (including a
      cross-claim or counterclaim in a lawsuit) alleging that the Work
      or a Contribution incorporated within the Work constitutes direct
      or contributory patent infringement, then any patent licenses
      granted to You under this License for that Work shall terminate
      as of the date such litigation is filed.

   4. Redistribution. You may reproduce and distribute copies of the
      Work or Derivative Works thereof in any medium, with or without
      modifications, and in Source or Object form, provided that You
      meet the following conditions:

      (a) You must give any other recipients of the Work or
          Derivative Works a copy of this License; and

      (b) You must cause any modified files to carry prominent notices
          stating that You changed the files; and

      (c) You must retain, in the Source form of any Derivative Works
          that You distribute, all copyright, patent, trademark, and
          attribution notices from the Source form of the Work,
          excluding those notices that do not pertain to any part of
          the Derivative Works; and

      (d) If the Work includes a "NOTICE" text file as part of its
          distribution, then any Derivative Works that You distribute must
          include a readable copy of the attribution notices contained
          within such NOTICE file, excluding those notices that do not
          pertain to any part of the Derivative Works, in at least one
          of the following places: within a NOTICE text file distributed
          as part of the Derivative Works; within the Source form or
          documentation, if provided along with the Derivative Works; or,
          within a display generated by the Derivative Works, if and
          wherever such third-party notices normally appear. The contents
          of the NOTICE file are for informational purposes only and
          do not modify the License. You may add Your own attribution
          notices within Derivative Works that You distribute, alongside
          or as an addendum to the NOTICE text from the Work, provided
          that such additional attribution notices cannot be construed
          as modifying the License.

      You may add Your own copyright statement to Your modifications and
      may provide additional or different license terms and conditions
      for use, reproduction, or distribution of Your modifications, or
      for any such Derivative Works as a whole, provided Your use,
      reproduction, and distribution of the Work otherwise complies with
      the conditions stated in this License.

   5. Submission of Contributions. Unless You explicitly state otherwise,
      any Contribution intentionally submitted for inclusion in the Work
      by You to the Licensor shall be under the terms and conditions of
      this License, without any additional terms or conditions.
      Notwithstanding the above, nothing herein shall supersede or modify
      the terms of any separate license agreement you may have executed
      with Licensor regarding such Contributions.

   6. Trademarks. This License does not grant permission to use the trade
      names, trademarks, service marks, or product names of the Licensor,
      except as required for reasonable and customary use in describing the
      origin of the Work and reproducing the content of the NOTICE file.

   7. Disclaimer of Warranty. Unless required by applicable law or
      agreed to in writing, Licensor provides the Work (and each
      Contributor provides its Contributions) on an "AS IS" BASIS,
      WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
      implied, including, without limitation, any warranties or conditions
      of TITLE, NON-INFRINGEMENT, MERCHANTABILITY, or FITNESS FOR A
      PARTICULAR PURPOSE. You are solely responsible for determining the
      appropriateness of using or redistributing the Work and assume any
      risks associated with Your exercise of permissions under this License.

   8. Limitation of Liability. In no event and under no legal theory,
      whether in tort (including negligence), contract, or otherwise,
      unless required by applicable law (such as deliberate and grossly
      negligent acts) or agreed to in writing, shall any Contributor be
      liable to You for damages, including any direct, indirect, special,
      incidental, or consequential damages of any character arising as a
      result of this License or out of the use or inability to use the
      Work (including but not limited to damages for loss of goodwill,
      work stoppage, computer failure or malfunction, or any and all
      other commercial damages or losses), even if such Contributor
      has been advised of the possibility of such damages.

   9. Accepting Warranty or Additional Liability. While redistributing
      the Work or Derivative Works thereof, You may choose to offer,
      and charge a fee for, acceptance of support, warranty, indemnity,
      or other liability obligations and/or rights consistent with this
      License. However, in accepting such obligations, You may act only
      on Your own behalf and on Your sole responsibility, not on behalf
      of any other Contributor, and only if You agree to indemnify,
      defend, and hold each Contributor harmless for any liability
      incurred by, or claims asserted against, such Contributor by reason
      of your accepting any such warranty or additional liability.

   END OF TERMS AND CONDITIONS

   APPENDIX: How to apply the Apache License to your work.

      To apply the Apache License to your work, attach the following
      boilerplate notice, with the fields enclosed by brackets "[]"
      replaced with your own identifying information. (Don't include
      the brackets!)  The text should be enclosed in the appropriate
      comment syntax for the file format. We also recommend that a
      file or class name and description of purpose be included on the
      same "printed page" as the copyright notice for easier
      identification within third-party archives.

   Copyright 2022 DFINITY Foundation

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.

-----------------------

/README.md:
-----------------------

# DFX Extensions
The official repository for dfx extensions.

-----------------------

/catalog.json:
-----------------------

{
  "nns": "https://raw.githubusercontent.com/dfinity/dfx-extensions/main/extensions/nns/extension.json",
  "sns": "https://raw.githubusercontent.com/dfinity/dfx-extensions/main/extensions/sns/extension.json"
}


-----------------------

/compatibility.json:
-----------------------

{
  "0.22.0": {
    "nns": {
      "versions": [
        "0.4.3"
      ]
    },
    "sns": {
      "versions": [
        "0.4.3"
      ]
    }
  },
  "0.21.0": {
    "nns": {
      "versions": [
        "0.3.1"
      ]
    },
    "sns": {
      "versions": [
        "0.3.1"
      ]
    }
  },
  "0.20.1": {
    "nns": {
      "versions": [
        "0.3.1"
      ]
    },
    "sns": {
      "versions": [
        "0.3.1"
      ]
    }
  },
  "0.20.0": {
    "nns": {
      "versions": [
        "0.3.1"
      ]
    },
    "sns": {
      "versions": [
        "0.3.1"
      ]
    }
  },
  "0.19.0": {
    "nns": {
      "versions": [
        "0.3.1"
      ]
    },
    "sns": {
      "versions": [
        "0.3.1"
      ]
    }
  },
  "0.18.0": {
    "nns": {
      "versions": [
        "0.3.1"
      ]
    },
    "sns": {
      "versions": [
        "0.3.1"
      ]
    }
  },
  "0.17.0": {
    "nns": {
      "versions": [
        "0.3.1"
      ]
    },
    "sns": {
      "versions": [
        "0.3.1"
      ]
    }
  },
  "0.16.1": {
    "nns": {
      "versions": [
        "0.2.1"
      ]
    },
    "sns": {
      "versions": [
        "0.2.1"
      ]
    }
  },
  "0.16.0": {
    "nns": {
      "versions": [
        "0.2.1"
      ]
    },
    "sns": {
      "versions": [
        "0.2.1"
      ]
    }
  },
  "0.15.3": {
    "nns": {
      "versions": [
        "0.2.1"
      ]
    },
    "sns": {
      "versions": [
        "0.2.1"
      ]
    }
  },
  "0.15.2": {
    "nns": {
      "versions": [
        "0.2.1"
      ]
    },
    "sns": {
      "versions": [
        "0.2.1"
      ]
    }
  },
  "0.15.1": {
    "nns": {
      "versions": [
        "0.2.1"
      ]
    },
    "sns": {
      "versions": [
        "0.2.1"
      ]
    }
  },
  "0.15.0": {
    "nns": {
      "versions": [
        "0.2.1"
      ]
    },
    "sns": {
      "versions": [
        "0.2.1"
      ]
    }
  },
  "0.14.4": {
    "nns": {
      "versions": [
        "0.1.0"
      ]
    },
    "sns": {
      "versions": [
        "0.1.0"
      ]
    }
  },
  "0.14.3": {
    "nns": {
      "versions": [
        "0.1.0"
      ]
    },
    "sns": {
      "versions": [
        "0.1.0"
      ]
    }
  }
}


-----------------------

/e2e/get_ephemeral_port.py:
-----------------------

import socket

with socket.socket() as s:
  s.bind(('', 0))
  print(s.getsockname()[1], end='')


-----------------------

/e2e/utils.sh:
-----------------------

set -e

load "$GIT_ROOT_DIR"/e2e/bats-support/load
load "$GIT_ROOT_DIR"/e2e/bats-assert/load

# Takes a name of the asset folder, and copy those files to the current project.
install_asset() {
    ASSET_ROOT="$(dirname "$BATS_TEST_FILENAME")"/../assets/$1
    cp -R "$ASSET_ROOT"/* .

    # shellcheck source=/dev/null
    if [ -f ./patch.bash ]; then source ./patch.bash; fi
    if [ -f ./Cargo.toml ]; then cargo update; fi
}

install_shared_asset() {
    mkdir -p "$(dirname "$E2E_NETWORKS_JSON")"

    ASSET_ROOT="$(dirname "$BATS_TEST_FILENAME")"/../assets/$1
    cp -R "$ASSET_ROOT"/* "$(dirname "$E2E_NETWORKS_JSON")"
}

dfx_extension_install_manually() (
    local extension_name="$1"
    extensions_dir="$(dfx cache show)/extensions"
    mkdir -p "$extensions_dir"
    cp -R "$PREBUILT_EXTENSIONS_DIR/$extension_name" "$extensions_dir/$extension_name"
)

standard_setup() {
    # We want to work from a temporary directory, different for every test.
    x=$(mktemp -d -t dfx-e2e-XXXXXXXX)
    export E2E_TEMP_DIR="$x"

    cache_root="${E2E_CACHE_ROOT:-"$HOME/.e2e-cache-root"}"

    if [ "$(uname)" == "Darwin" ]; then
        project_relative_path="Library/Application Support/org.dfinity.dfx"
    elif [ "$(uname)" == "Linux" ]; then
        project_relative_path=".local/share/dfx"
    fi

    mkdir "$x/working-dir"
    mkdir -p "$cache_root"
    mkdir "$x/config-root"
    mkdir "$x/home-dir"

    # we need to configure dfxvm in the isolated home directory
    default_dfx_version="$(dfxvm default)"
    # don't re-download dfx for every test
    mkdir -p "$x/home-dir/$project_relative_path"
    ln -s "$HOME/$project_relative_path/versions" "$x/home-dir/$project_relative_path/versions"

    cd "$x/working-dir" || exit

    export HOME="$x/home-dir"
    export DFX_CACHE_ROOT="$cache_root"
    export DFX_CONFIG_ROOT="$x/config-root"
    export RUST_BACKTRACE=1
    export MOCK_KEYRING_LOCATION="$HOME/mock_keyring.json"

    export E2E_SHARED_LOCAL_NETWORK_DATA_DIRECTORY="$HOME/$project_relative_path/network/local"
    export E2E_NETWORKS_JSON="$DFX_CONFIG_ROOT/.config/dfx/networks.json"

    dfxvm default "$default_dfx_version"
    dfx cache install
}

standard_teardown() {
    rm -rf "$E2E_TEMP_DIR" || rm -rf "$E2E_TEMP_DIR"
}

dfx_new_frontend() {
    local project_name=${1:-e2e_project}
    dfx new "${project_name}" --frontend simple-assets
    test -d "${project_name}"
    test -f "${project_name}"/dfx.json
    cd "${project_name}"

    echo PWD: "$(pwd)" >&2
}

dfx_new() {
    local project_name=${1:-e2e_project}
    dfx new "${project_name}" --no-frontend
    test -d "${project_name}"
    test -f "${project_name}/dfx.json"
    cd "${project_name}"

    echo PWD: "$(pwd)" >&2
}

dfx_new_rust() {
    local project_name=${1:-e2e_project}
    rustup default stable
    rustup target add wasm32-unknown-unknown
    dfx new "${project_name}" --type=rust --no-frontend
    test -d "${project_name}"
    test -f "${project_name}/dfx.json"
    test -f "${project_name}/Cargo.toml"
    test -f "${project_name}/Cargo.lock"
    cd "${project_name}"

    echo PWD: "$(pwd)" >&2
}

dfx_patchelf() {
    # Don't run this function during github actions
    [ "$GITHUB_ACTIONS" ] && return 0

    # Only run this function on Linux
    (uname -a | grep Linux) || return 0

    local CACHE_DIR LD_LINUX_SO BINARY IS_STATIC USE_LIB64

    echo dfx = "$(which dfx)"
    CACHE_DIR="$(dfx cache show)"

    # Both ldd and iconv are providedin glibc.bin package
    LD_LINUX_SO=$(ldd "$(which iconv)"|grep ld-linux-x86|cut -d' ' -f3)
    for binary in ic-starter icx-proxy replica; do
        BINARY="${CACHE_DIR}/${binary}"
        test -f "$BINARY" || continue
        IS_STATIC=$(ldd "${BINARY}" | grep 'not a dynamic executable')
        USE_LIB64=$(ldd "${BINARY}" | grep '/lib64/ld-linux-x86-64.so.2')
        chmod +rw "${BINARY}"
        test -n "$IS_STATIC" || test -z "$USE_LIB64" || patchelf --set-interpreter "${LD_LINUX_SO}" "${BINARY}"
    done
}

determine_network_directory() {
    # not perfect: dfx.json can actually exist in a parent
    if [ -f dfx.json ] && [ "$(jq .networks.local dfx.json)" != "null" ]; then
        echo "found dfx.json with local network in $(pwd)"
        data_dir="$(pwd)/.dfx/network/local"
        wallets_json="$(pwd)/.dfx/local/wallets.json"
        dfx_json="$(pwd)/dfx.json"
        export E2E_NETWORK_DATA_DIRECTORY="$data_dir"
        export E2E_NETWORK_WALLETS_JSON="$wallets_json"
        export E2E_ROUTE_NETWORKS_JSON="$dfx_json"
    else
        echo "no dfx.json"
        export E2E_NETWORK_DATA_DIRECTORY="$E2E_SHARED_LOCAL_NETWORK_DATA_DIRECTORY"
        export E2E_NETWORK_WALLETS_JSON="$E2E_NETWORK_DATA_DIRECTORY/wallets.json"
        export E2E_ROUTE_NETWORKS_JSON="$E2E_NETWORKS_JSON"
    fi
}

# Start the replica in the background.
dfx_start() {
    local port dfx_config_root webserver_port
    dfx_patchelf

    # Start on random port for parallel test execution
    FRONTEND_HOST="127.0.0.1:0"

    determine_network_directory
    if [ "$USE_IC_REF" ]
    then
        if [[ $# -eq 0 ]]; then
            dfx start --emulator --background --host "$FRONTEND_HOST" 3>&-
        else
            batslib_decorate "no arguments to dfx start --emulator supported yet"
            fail
        fi

        test -f "$E2E_NETWORK_DATA_DIRECTORY/ic-ref.port"
        port=$(cat "$E2E_NETWORK_DATA_DIRECTORY/ic-ref.port")
    else
        # Bats creates a FD 3 for test output, but child processes inherit it and Bats will
        # wait for it to close. Because `dfx start` leaves child processes running, we need
        # to close this pipe, otherwise Bats will wait indefinitely.
        if [[ $# -eq 0 ]]; then
            dfx start --background --host "$FRONTEND_HOST" --artificial-delay 100 3>&- # Start on random port for parallel test execution
        else
            dfx start --background --artificial-delay 100 "$@" 3>&-
        fi

        dfx_config_root="$E2E_NETWORK_DATA_DIRECTORY/replica-configuration"
        printf "Configuration Root for DFX: %s\n" "${dfx_config_root}"
        test -f "${dfx_config_root}/replica-1.port"
        port=$(cat "${dfx_config_root}/replica-1.port")
    fi

    webserver_port=$(cat "$E2E_NETWORK_DATA_DIRECTORY/webserver-port")

    printf "Replica Configured Port: %s\n" "${port}"
    printf "Webserver Configured Port: %s\n" "${webserver_port}"

    timeout 5 sh -c \
        "until nc -z localhost ${port}; do echo waiting for replica; sleep 1; done" \
        || (echo "could not connect to replica on port ${port}" && exit 1)
}

# Tries to start dfx on the default port, repeating until it succeeds or times out.
#
# Motivation: dfx nns install works only on port 8080, as URLs are compiled into the wasms.  This means that multiple
# tests MAY compete for the same port.
# - It may be possible in future for the wasms to detect their own URL and recompute signatures accordingly,
#   however until such a time, we have this restriction.
# - It may also be that ic-nns-install, if used on a non-standard port, installs only the core canisters not the UI.
# - However until we have implemented good solutions, all tests on ic-nns-install must run on port 8080.
dfx_start_for_nns_install() {
    # TODO: When nns-dapp supports dynamic ports, this wait can be removed.
    timeout 300 sh -c \
        "until dfx start --clean --background --host 127.0.0.1:8080 --verbose ; do echo waiting for port 8080 to become free; sleep 3; done" \
        || (echo "could not connect to replica on port 8080" && exit 1)
    # TODO: figure out how to plug bats' "run" into above statement,
    #       so that below asserts will work as expected
    # assert_success
    # assert_output --partial "subnet type: System"
    # assert_output --partial "bind address: 127.0.0.1:8080"
}

wait_until_replica_healthy() {
    echo "waiting for replica to become healthy"
    dfx ping --wait-healthy
    echo "replica became healthy"
}

# Start the replica in the background.
dfx_replica() {
    local replica_port dfx_config_root
    dfx_patchelf
    determine_network_directory
    if [ "$USE_IC_REF" ]
    then
        # Bats creates a FD 3 for test output, but child processes inherit it and Bats will
        # wait for it to close. Because `dfx start` leaves child processes running, we need
        # to close this pipe, otherwise Bats will wait indefinitely.
        dfx replica --emulator --port 0 "$@" 3>&- &
        export DFX_REPLICA_PID=$!

        timeout 60 sh -c \
            "until test -s \"$E2E_NETWORK_DATA_DIRECTORY/ic-ref.port\"; do echo waiting for ic-ref port; sleep 1; done" \
            || (echo "replica did not write to \"$E2E_NETWORK_DATA_DIRECTORY/ic-ref.port\" file" && exit 1)

        test -f "$E2E_NETWORK_DATA_DIRECTORY/ic-ref.port"
        replica_port=$(cat "$E2E_NETWORK_DATA_DIRECTORY/ic-ref.port")

    else
        # Bats creates a FD 3 for test output, but child processes inherit it and Bats will
        # wait for it to close. Because `dfx start` leaves child processes running, we need
        # to close this pipe, otherwise Bats will wait indefinitely.
        dfx replica --port 0 "$@" 3>&- &
        export DFX_REPLICA_PID=$!

        timeout 60 sh -c \
            "until test -s \"$E2E_NETWORK_DATA_DIRECTORY/replica-configuration/replica-1.port\"; do echo waiting for replica port; sleep 1; done" \
            || (echo "replica did not write to port file" && exit 1)

        dfx_config_root="$E2E_NETWORK_DATA_DIRECTORY/replica-configuration"
        test -f "${dfx_config_root}/replica-1.port"
        replica_port=$(cat "${dfx_config_root}/replica-1.port")

    fi

    printf "Replica Configured Port: %s\n" "${replica_port}"

    timeout 5 sh -c \
        "until nc -z localhost ${replica_port}; do echo waiting for replica; sleep 1; done" \
        || (echo "could not connect to replica on port ${replica_port}" && exit 1)

    # ping the replica directly, because the bootstrap (that launches icx-proxy, which dfx ping usually connects to)
    # is not running yet
    dfx ping --wait-healthy "http://127.0.0.1:${replica_port}"
}

dfx_bootstrap() {
    # This only works because we use the network by name
    #    (implicitly: --network local)
    # If we passed --network http://127.0.0.1:${replica_port}
    # we would get errors like this:
    #    "Cannot find canister ryjl3-tyaaa-aaaaa-aaaba-cai for network http___127_0_0_1_54084"
    dfx bootstrap --port 0 3>&- &
    export DFX_BOOTSTRAP_PID=$!

    timeout 5 sh -c \
        "until nc -z localhost \$(cat \"$E2E_NETWORK_DATA_DIRECTORY/webserver-port\"); do echo waiting for webserver; sleep 1; done" \
        || (echo "could not connect to webserver on port $(get_webserver_port)" && exit 1)

    wait_until_replica_healthy

    webserver_port=$(cat "$E2E_NETWORK_DATA_DIRECTORY/webserver-port")
    printf "Webserver Configured Port: %s\n", "${webserver_port}"
}

# Stop the `dfx replica` process that is running in the background.
stop_dfx_replica() {
    [ "$DFX_REPLICA_PID" ] && kill -TERM "$DFX_REPLICA_PID"
    unset DFX_REPLICA_PID
}

# Stop the `dfx bootstrap` process that is running in the background
stop_dfx_bootstrap() {
    [ "$DFX_BOOTSTRAP_PID" ] && kill -TERM "$DFX_BOOTSTRAP_PID"
    unset DFX_BOOTSTRAP_PID
}

# Stop the replica and verify it is very very stopped.
dfx_stop() {
    # to help tell if other icx-proxy processes are from this test:
    echo "pwd: $(pwd)"
    # A suspicion: "address already is use" errors are due to an extra icx-proxy process.
    echo "icx-proxy processes:"
    pgrep -l icx-proxy || echo "no ps/grep/icx-proxy output"

    dfx stop
    local dfx_root=.dfx/
    rm -rf $dfx_root

    # Verify that processes are killed.
    assert_no_dfx_start_or_replica_processes
}

dfx_set_wallet() {
  export WALLET_CANISTER_ID
  WALLET_CANISTER_ID=$(dfx identity get-wallet)
  assert_command dfx identity set-wallet "${WALLET_CANISTER_ID}" --force --network actuallylocal
  assert_match 'Wallet set successfully.'
}

setup_actuallylocal_project_network() {
    webserver_port=$(get_webserver_port)
    # [ ! -f "$E2E_ROUTE_NETWORKS_JSON" ] && echo "{}" >"$E2E_ROUTE_NETWORKS_JSON"
    jq '.networks.actuallylocal.providers=["http://127.0.0.1:'"$webserver_port"'"]' dfx.json | sponge dfx.json
}

setup_actuallylocal_shared_network() {
    webserver_port=$(get_webserver_port)
    [ ! -f "$E2E_NETWORKS_JSON" ] && echo "{}" >"$E2E_NETWORKS_JSON"
    jq '.actuallylocal.providers=["http://127.0.0.1:'"$webserver_port"'"]' "$E2E_NETWORKS_JSON" | sponge "$E2E_NETWORKS_JSON"
}

setup_local_shared_network() {
    local replica_port
    if [ "$USE_IC_REF" ]
    then
        replica_port=$(get_ic_ref_port)
    else
        replica_port=$(get_replica_port)
    fi

    [ ! -f "$E2E_NETWORKS_JSON" ] && echo "{}" >"$E2E_NETWORKS_JSON"

    jq ".local.bind=\"127.0.0.1:${replica_port}\"" "$E2E_NETWORKS_JSON" | sponge "$E2E_NETWORKS_JSON"
}

use_wallet_wasm() {
    # shellcheck disable=SC2154
    export DFX_WALLET_WASM="${archive}/wallet/$1/wallet.wasm"
}

use_asset_wasm() {
    # shellcheck disable=SC2154
    export DFX_ASSETS_WASM="${archive}/frontend/$1/assetstorage.wasm.gz"
}

wallet_sha() {
    shasum -a 256 "${archive}/wallet/$1/wallet.wasm" | awk '{ print $1 }'
}

use_default_wallet_wasm() {
    unset DFX_WALLET_WASM
}

use_default_asset_wasm() {
    unset DFX_ASSETS_WASM
}

get_webserver_port() {
  dfx info webserver-port
}
overwrite_webserver_port() {
  echo "$1" >"$E2E_NETWORK_DATA_DIRECTORY/webserver-port"
}

get_replica_pid() {
  cat "$E2E_NETWORK_DATA_DIRECTORY/replica-configuration/replica-pid"
}

get_ic_ref_port() {
  cat "$E2E_NETWORK_DATA_DIRECTORY/ic-ref.port"

}
get_replica_port() {
  cat "$E2E_NETWORK_DATA_DIRECTORY/replica-configuration/replica-1.port"
}

get_btc_adapter_pid() {
  cat "$E2E_NETWORK_DATA_DIRECTORY/ic-btc-adapter-pid"
}

get_canister_http_adapter_pid() {
  cat "$E2E_NETWORK_DATA_DIRECTORY/ic-canister-http-adapter-pid"
}

get_icx_proxy_pid() {
  cat "$E2E_NETWORK_DATA_DIRECTORY/icx-proxy-pid"
}

create_networks_json() {
  mkdir -p "$(dirname "$E2E_NETWORKS_JSON")"
  [ ! -f "$E2E_NETWORKS_JSON" ] && echo "{}" >"$E2E_NETWORKS_JSON"
}

define_project_network() {
    jq .networks.local.bind=\"127.0.0.1:8000\" dfx.json | sponge dfx.json
}

use_test_specific_cache_root() {
    # Use this when a test depends on the initial state of the cache being empty,
    # or if the test corrupts the cache in some way.
    # The effect is to ignore the E2E_CACHE_ROOT environment variable, if set.
    export DFX_CACHE_ROOT="$E2E_TEMP_DIR/cache-root"
    mkdir -p "$DFX_CACHE_ROOT"
}

start_webserver() {
    local port script_dir
    script_dir=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
    port=$(python3 "$script_dir/get_ephemeral_port.py")
    export E2E_WEB_SERVER_PORT="$port"

    python3 -m http.server "$E2E_WEB_SERVER_PORT" "$@" &
    export E2E_WEB_SERVER_PID=$!

    while ! nc -z localhost "$E2E_WEB_SERVER_PORT"; do
      sleep 1
    done
}

stop_webserver() {
    if [ "$E2E_WEB_SERVER_PID" ]; then
        kill "$E2E_WEB_SERVER_PID"
    fi
}

# Asserts that the contents of two files are equal.
# Arguments:
#    $1 - The name of the file containing the expected value.
#    $2 - The name of the file containing the actual value.
assert_files_eq() {
    expected="$(cat "$1")"
    actual="$(cat "$2")"

    if [[ ! "$actual" == "$expected" ]]; then
        diff "$1" "$2" \
            | batslib_decorate "contents of $1 do not match contents of $2" \
            | fail
    fi
}

# Asserts that `dfx start` and `replica` are no longer running
assert_no_dfx_start_or_replica_processes() {
    ! ( pgrep "dfx start" )
    if [ -e .dfx/replica-configuration/replica-pid ];
    then
      ! ( kill -0 "$(< .dfx/replica-configuration/replica-pid)" 2>/dev/null )
    fi
}


-----------------------

/extensions-utils/Cargo.toml:
-----------------------

[package]
name = "dfx-extensions-utils"
version = "0.0.0"
authors.workspace = true
edition.workspace = true
license.workspace = true
repository.workspace = true
publish = false

# See more keys and their definitions at https://doc.rust-lang.org/cargo/reference/manifest.html

[build-dependencies]
flate2.workspace = true
reqwest.workspace = true

[dependencies]
dfx-core.workspace = true

anyhow.workspace = true
backoff = { version = "0.4.0", features = ["futures", "tokio"] }
flate2 = { version = "1.0.25", default-features = false, features = [
    "zlib-ng",
] }
fn-error-context.workspace = true
futures-util.workspace = true
hyper-rustls = { version = "0.23.0", features = ["webpki-roots", "http2"] }
reqwest.workspace = true
rustls = "0.20.4"
semver = "1.0.17"
serde.workspace = true
serde_json.workspace = true
slog-async = "2.4.0"
slog-term = "2.9.0"
slog.workspace = true
tempfile.workspace = true
thiserror = "1.0.40"
tokio.workspace = true
url.workspace = true
candid.workspace = true
clap.workspace = true


-----------------------

/extensions-utils/src/dependencies/call.rs:
-----------------------

use crate::dependencies::execute_command;
use anyhow::anyhow;
use fn_error_context::context;
use std::{env, ffi::OsStr, path::Path};

/// Calls a binary that was delivered with an extension tarball.
///
/// # Returns
/// - On success, returns stdout as a string.
/// - On error, returns an error message including stdout and stderr.
///
/// Does not print stdout/stderr to the console, and instead returns the output to the caller after the process has exited.
#[context("Calling {} CLI failed, or, it returned an error.", binary_name)]
pub fn call_extension_bundled_binary<S, I>(
    binary_name: &str,
    args: I,
    dfx_cache_path: &Path,
) -> anyhow::Result<()>
where
    I: IntoIterator<Item = S>,
    S: AsRef<OsStr>,
{
    let extension_binary_path =
        env::current_exe().map_err(|e| anyhow!("Failed to get current exe: {}", e))?;
    let extension_dir_path = extension_binary_path.parent().ok_or_else(|| {
        anyhow!(
            "Failed to locate parent of dir of executable: {}",
            extension_binary_path.display()
        )
    })?;
    let binary_to_call = extension_dir_path.join(binary_name);
    execute_command(&binary_to_call, args, dfx_cache_path)
}


-----------------------

/extensions-utils/src/dependencies/dfx.rs:
-----------------------

use crate::dependencies::execute_command;
use crate::error::dfx_executable::DfxError;
use fn_error_context::context;
use semver::Version;
use std::ffi::OsStr;
use std::path::Path;
use std::process::Command;

/// Calls a binary from dfx cache.
///
/// # Returns
/// - On success, returns stdout as a string.
/// - On error, returns an error message including stdout and stderr.
///
/// Does not print stdout/stderr to the console, and instead returns the output to the caller after the process has exited.
#[context("Calling {} CLI failed, or, it returned an error.", command)]
pub fn call_dfx_bundled_binary<S, I>(
    command: &str,
    args: I,
    dfx_cache_path: &Path,
) -> anyhow::Result<()>
where
    I: IntoIterator<Item = S>,
    S: AsRef<OsStr>,
{
    let binary = dfx_cache_path.join(command);
    execute_command(&binary, args, dfx_cache_path)
}

pub fn replica_rev(dfx_cache_path: &Path) -> Result<String, DfxError> {
    let args = ["info", "replica-rev"];
    let rev = Command::new(dfx_cache_path.join("dfx"))
        .args(args)
        .output()
        .map_err(DfxError::DfxExecutableError)?
        .stdout
        .iter()
        .map(|c| *c as char)
        .collect::<String>()
        .trim()
        .to_string();
    if rev.len() != 40 {
        return Err(DfxError::MalformedCommandOutput {
            command: args.join(" ").to_string(),
            output: rev,
        });
    }
    Ok(rev)
}

pub fn dfx_version(dfx_cache_path: &Path) -> Result<String, DfxError> {
    let args = ["--version"];
    let version_cmd_output = Command::new(dfx_cache_path.join("dfx"))
        .args(args)
        .output()
        .map_err(DfxError::DfxExecutableError)?
        .stdout
        .iter()
        .map(|c| *c as char)
        .collect::<String>();
    if let Some(version) = version_cmd_output.split_whitespace().last() {
        Version::parse(version) // make sure the output is really a version
            .map_err(DfxError::DfxVersionMalformed)
            .map(|v| v.to_string())
    } else {
        Err(DfxError::MalformedCommandOutput {
            command: args.join(" ").to_string(),
            output: version_cmd_output,
        })
    }
}


-----------------------

/extensions-utils/src/dependencies/download_ic_binaries.rs:
-----------------------

use backoff::future::retry;
use backoff::ExponentialBackoffBuilder;
use flate2::read::GzDecoder;
use std::path::Path;
use std::time::Duration;
use std::{fs, io::copy};
use tokio::runtime::Runtime;

pub fn download_ic_binary(replica_rev: &str, binary_name: &str, destination_path: &Path) {
    let arch = match std::env::consts::ARCH {
        "x86_64" => "x86_64",
        "aarch64" => "x86_64", // let's rely on rosetta2 for now, since ic binaiers are not available for arm64
        _ => panic!("Unsupported architecture"),
    };
    let os = match std::env::consts::OS {
        "macos" => "darwin",
        "linux" => "linux",
        // "windows" => "windows", // unsupported till dfx supports windows
        _ => panic!("Unsupported OS"),
    };

    let url = format!(
        "https://download.dfinity.systems/ic/{replica_rev}/binaries/{arch}-{os}/{binary_name}.gz",
        arch = arch,
        os = os,
        binary_name = binary_name,
    );
    println!("Downloading {}", url);

    let bytes = Runtime::new().unwrap().block_on(download_bytes(&url));
    let mut d = GzDecoder::new(&*bytes);
    let tempdir = tempfile::tempdir().expect("Failed to create temp dir");
    let temp_file = tempdir.path().join(binary_name);
    let mut temp = fs::File::create(&temp_file).expect("Failed to create the file");
    copy(&mut d, &mut temp).expect("Failed to copy content");

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        dfx_core::fs::set_permissions(&temp_file, std::fs::Permissions::from_mode(0o500))
            .expect("Failed to set permissions");
    }
    // fs::move is not safe here, as that operations would fail if src and dst are on different FSs.
    if destination_path.exists() {
        fs::remove_file(destination_path).unwrap_or_else(|err| {
            panic!(
                "Failed to remove existing file `{:?}`: {}",
                destination_path, err
            );
        });
    }
    fs::copy(temp_file.clone(), destination_path).unwrap_or_else(|err| {
        panic!(
            "Failed to copy extension from `{:?}` to `{:?}`: {}",
            temp_file, destination_path, err
        );
    });
}

async fn download_bytes(url: &str) -> Vec<u8> {
    let retry_policy = ExponentialBackoffBuilder::new()
        .with_initial_interval(Duration::from_secs(1))
        .with_max_interval(Duration::from_secs(16))
        .with_multiplier(2.0)
        .with_max_elapsed_time(Some(Duration::from_secs(300)))
        .build();
    let resp = retry(retry_policy, || async {
        match reqwest::get(url).await {
            Ok(response) => Ok(response),
            Err(err) => Err(backoff::Error::transient(err)),
        }
    })
    .await
    .unwrap();

    let bytes = resp.bytes().await.expect("Failed to read response");
    bytes.to_vec()
}


-----------------------

/extensions-utils/src/dependencies/download_wasms/mod.rs:
-----------------------

pub mod nns;
pub mod sns;

use anyhow::Context;
use dfx_core::fs;
use flate2::read::GzDecoder;
use fn_error_context::context;

use url::Url;

use std::path::{Component, Path};

/// Downloads a file (this function should be used for canister modules)
#[context("Failed to download '{:?}' from '{:?}'.", target, source.as_str())]
pub async fn download_gz(source: &Url, target: &Path) -> anyhow::Result<()> {
    download_gz_and_maybe_ungzip(source, target, false).await
}

/// Downloads and unzips a file (this function should be used for x86 binaries)
#[context("Failed to download and unzip '{:?}' from '{:?}'.", target, source.as_str())]
pub async fn download_gz_and_ungzip(source: &Url, target: &Path) -> anyhow::Result<()> {
    download_gz_and_maybe_ungzip(source, target, true).await
}

pub async fn download_gz_and_maybe_ungzip(
    source: &Url,
    target: &Path,
    unzip: bool,
) -> anyhow::Result<()> {
    if target.exists() {
        println!("Already downloaded: {}", target.to_string_lossy());
        return Ok(());
    }
    println!(
        "Downloading {}\n  from .gz: {}",
        target.to_string_lossy(),
        source.as_str()
    );
    let response = reqwest::get(source.clone())
        .await
        .with_context(|| "Failed to connect")?
        .bytes()
        .await
        .with_context(|| "Download was interrupted")?;

    let target_parent = target
        .parent()
        .unwrap_or_else(|| Path::new(Component::CurDir.as_os_str()));
    let tmp_dir = tempfile::TempDir::new_in(target_parent)
        .with_context(|| "Failed to create temporary directory for download")?;
    let downloaded_filename = {
        let filename = tmp_dir.path().join("wasm");
        let mut file = std::fs::File::create(&filename).with_context(|| {
            format!(
                "Failed to write temp file when downloading '{}'.",
                filename.display()
            )
        })?;
        if unzip {
            let mut decoder = GzDecoder::new(&response[..]);
            std::io::copy(&mut decoder, &mut file)
                .with_context(|| format!("Failed to unzip WASM to '{}'", filename.display()))?;
        } else {
            std::io::copy(&mut response.as_ref(), &mut file)
                .with_context(|| format!("Failed copy WASM to '{}'", filename.display()))?;
        }
        filename
    };
    fs::rename(&downloaded_filename, target).with_context(|| {
        format!(
            "Failed to move downloaded tempfile '{}' to '{}'.",
            downloaded_filename.display(),
            target.display()
        )
    })?;
    Ok(())
}

/// Downloads wasm file from the main IC repo CI.
#[context("Failed to download {} from the IC CI.", wasm_name)]
pub async fn download_ic_repo_wasm(
    wasm_name: &str,
    ic_commit: &str,
    wasm_dir: &Path,
) -> anyhow::Result<()> {
    fs::create_dir_all(wasm_dir)
        .with_context(|| format!("Failed to create wasm directory: '{}'", wasm_dir.display()))?;
    let final_path = wasm_dir.join(wasm_name);
    let url_str =
        format!("https://download.dfinity.systems/ic/{ic_commit}/canisters/{wasm_name}.gz");
    let url = Url::parse(&url_str)
      .with_context(|| format!("Could not determine download URL. Are ic_commit '{ic_commit}' and wasm_name '{wasm_name}' valid?"))?;
    download_gz(&url, &final_path).await
}


-----------------------

/extensions-utils/src/dependencies/download_wasms/nns.rs:
-----------------------

/extensions-utils/src/dependencies/download_wasms/sns.rs:
-----------------------

use std::path::Path;

use anyhow;
use fn_error_context::context;
use futures_util::future::try_join_all;

use crate::download_ic_repo_wasm;

/// Downloads all the core SNS wasms.
#[context("Failed to download SNS wasm files.")]
pub async fn download_sns_wasms(ic_commit: &str, wasms_dir: &Path) -> anyhow::Result<()> {
    try_join_all(
        SNS_CANISTERS
            .iter()
            .map(|SnsCanisterInstallation { wasm_name, .. }| {
                download_ic_repo_wasm(wasm_name, ic_commit, wasms_dir)
            }),
    )
    .await?;
    Ok(())
}

/// Information required for WASMs uploaded to the nns-sns-wasm canister.
///
/// Note:  These wasms are not deployed by `ic nns install` but later by developers
pub struct SnsCanisterInstallation {
    /// The name of the canister as typically added to dfx.json or used in `dfx cansiter id NAME`
    pub canister_name: &'static str,
    /// The name used when uploading to the nns-sns-wasm canister.
    pub upload_name: &'static str,
    /// The basename of the wasm file.
    pub wasm_name: &'static str,
}
/// The controller of all the canisters in a given SNS project.
pub const SNS_ROOT: SnsCanisterInstallation = SnsCanisterInstallation {
    canister_name: "sns-root",
    upload_name: "root",
    wasm_name: "sns-root-canister.wasm",
};
/// The governance canister for an SNS project.
pub const SNS_GOVERNANCE: SnsCanisterInstallation = SnsCanisterInstallation {
    canister_name: "sns-governance",
    upload_name: "governance",
    wasm_name: "sns-governance-canister.wasm",
};
/// Manages the decentralisation of an SNS project, exchanging stake in the mainnet for stake in the project.
pub const SNS_SWAP: SnsCanisterInstallation = SnsCanisterInstallation {
    canister_name: "sns-swap",
    upload_name: "swap",
    wasm_name: "sns-swap-canister.wasm",
};
/// Stores account balances for an SNS project.
pub const SNS_LEDGER: SnsCanisterInstallation = SnsCanisterInstallation {
    canister_name: "sns-ledger",
    upload_name: "ledger",
    wasm_name: "ic-icrc1-ledger.wasm",
};
/// Stores ledger data; needed to preserve data if an SNS ledger canister is upgraded.
pub const SNS_LEDGER_ARCHIVE: SnsCanisterInstallation = SnsCanisterInstallation {
    canister_name: "sns-ledger-archive",
    upload_name: "archive",
    wasm_name: "ic-icrc1-archive.wasm",
};
/// Indexes ledger data.
pub const SNS_INDEX: SnsCanisterInstallation = SnsCanisterInstallation {
    canister_name: "sns-index",
    upload_name: "index",
    wasm_name: "ic-icrc1-index-ng.wasm",
};
/// SNS wasm files hosted by the nns-sns-wasms canister.
///
/// Note:  Sets of these canisters are deployed on request, so one network will
/// typically have many sets of these canisters, one per project decentralized
/// with the SNS toolchain.
pub const SNS_CANISTERS: [&SnsCanisterInstallation; 6] = [
    &SNS_ROOT,
    &SNS_GOVERNANCE,
    &SNS_SWAP,
    &SNS_LEDGER,
    &SNS_LEDGER_ARCHIVE,
    &SNS_INDEX,
];


-----------------------

/extensions-utils/src/dependencies/mod.rs:
-----------------------

use anyhow::anyhow;
use std::{
    env,
    ffi::OsStr,
    path::Path,
    process::{self, Command},
};

pub mod call;
pub mod dfx;
pub mod download_ic_binaries;
pub mod download_wasms;

pub fn execute_command(
    binary_path: &Path,
    args: impl IntoIterator<Item = impl AsRef<OsStr>>,
    dfx_cache_path: &Path,
) -> anyhow::Result<()> {
    let mut command = Command::new(binary_path);
    command.args(args);
    if let Some(old_path) = env::var_os("PATH") {
        let mut paths = env::split_paths(&old_path).collect::<Vec<_>>();
        paths.push(dfx_cache_path.to_path_buf());
        let new_path = env::join_paths(paths)?;
        command.env("PATH", new_path);
    } else {
        command.env("PATH", dfx_cache_path);
    }
    command.stdin(process::Stdio::inherit());
    command.stdout(process::Stdio::inherit());
    command.stderr(process::Stdio::inherit());

    let status = command
        .status()
        // e.g. "No such file or directory (os error 2)"
        .map_err(|e| {
            anyhow!(
                "Failed to execute binary at path '{}': {}",
                binary_path.display(),
                e
            )
        })?;

    if status.success() {
        Ok(())
    } else {
        // running the command failed (exit code != 0)
        Err(anyhow!("Command execution failed: {:#?}", command))
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::io::Write;
    use std::os::unix::fs::PermissionsExt;
    use tempfile::NamedTempFile;

    #[test]
    /// Create a temporary script that always succeeds
    fn test_execute_command_successful() {
        let mut temp_script = NamedTempFile::new().unwrap();
        writeln!(temp_script, "#!/bin/sh\nexit 0").unwrap();
        let path = temp_script.path().to_owned();
        if cfg!(unix) {
            fs::set_permissions(&path, fs::Permissions::from_mode(0o755)).unwrap();
        }
        let args: Vec<String> = vec![];
        let result = execute_command(&path, args, Path::new("."));
        assert!(result.is_ok());
    }

    #[test]
    /// Create a temporary script that always fails
    fn test_execute_command_fail() {
        let mut temp_script = NamedTempFile::new().unwrap();
        writeln!(temp_script, "#!/bin/sh\nexit 1").unwrap();
        let path = temp_script.path().to_owned();
        if cfg!(unix) {
            fs::set_permissions(&path, fs::Permissions::from_mode(0o755)).unwrap();
        }
        let args: Vec<String> = vec!["arg".into()];
        let result = execute_command(&path, args, Path::new("."));
        if let Err(e) = &result {
            assert!(e.to_string().contains(&format!(
                r#"Command execution failed: Command {{
    program: "{binary}",
    args: [
        "{binary}",
        "arg",
    ],
    env: CommandEnv {{
        clear: false,
        vars: {{
            "PATH": Some(
                "{path}:.",
            ),
        }},
    }}"#,
                binary = path.display(),
                path = env::var("PATH").unwrap()
            )));
        } else {
            panic!("Expected an error, but got {:?}", result);
        }
    }

    #[test]
    /// Try executing a non-existent command
    fn test_execute_command_nonexistent() {
        let args: Vec<String> = vec![];
        let result = execute_command(Path::new("/nonexistent/binary"), args, Path::new("."));
        if let Err(e) = &result {
            assert_eq!(
                e.to_string(),
                "Failed to execute binary at path '/nonexistent/binary': No such file or directory (os error 2)"
            );
        } else {
            panic!("Expected an error, but got {:?}", result);
        }
    }
}


-----------------------

/extensions-utils/src/error/dfx_executable.rs:
-----------------------

use thiserror::Error;

#[derive(Error, Debug)]
pub enum DfxError {
    #[error("Failed to execute dfx as a command: {0}")]
    DfxExecutableError(std::io::Error),

    #[error("Failed to execute dfx as a command: {0}")]
    DfxVersionMalformed(semver::Error),

    #[error("Unexpected output from `dfx {command}`: {output}")]
    MalformedCommandOutput { command: String, output: String },

    #[error("Cache for dfx version {0} is missing")]
    DfxCacheNotInstalled(String),
}


-----------------------

/extensions-utils/src/error/mod.rs:
-----------------------

pub mod dfx_executable;


-----------------------

/extensions-utils/src/lib.rs:
-----------------------

//! Library for calling bundled command line tools.

pub mod dependencies;
mod error;
mod logger;
pub mod manifest;
mod project;

pub use dependencies::{
    call::call_extension_bundled_binary,
    dfx::{call_dfx_bundled_binary, dfx_version, replica_rev},
    download_ic_binaries::download_ic_binary,
    download_wasms::{
        download_ic_repo_wasm,
        nns::{
            download_nns_wasms, nns_wasm_dir, IcNnsInitCanister, StandardCanister,
            ED25519_TEST_ACCOUNT, NNS_CORE, NNS_CORE_MANUAL, NNS_FRONTEND, NNS_SNS_WASM,
            SECP256K1_TEST_ACCOUNT,
        },
        sns::{download_sns_wasms, SnsCanisterInstallation, SNS_CANISTERS},
    },
};
pub use logger::new_logger;
pub use project::import::import_canister_definitions;
pub use project::network_mappings::get_network_mappings;

// for nns
pub use project::import::{
    get_canisters_json_object, set_remote_canister_ids, ImportNetworkMapping,
};


-----------------------

/extensions-utils/src/logger.rs:
-----------------------

use slog::{Drain, Logger};

pub struct TermLogFormat<D>
where
    D: slog_term::Decorator,
{
    decorator: D,
}

impl<D: slog_term::Decorator> TermLogFormat<D> {
    pub fn new(decorator: D) -> TermLogFormat<D> {
        TermLogFormat { decorator }
    }
}

impl<D: slog_term::Decorator> slog::Drain for TermLogFormat<D> {
    type Ok = ();
    type Err = std::io::Error;

    fn log(
        &self,
        record: &slog::Record<'_>,
        values: &slog::OwnedKVList,
    ) -> std::result::Result<Self::Ok, Self::Err> {
        self.decorator.with_record(record, values, |decorator| {
            if record.level() <= slog::Level::Warning {
                decorator.start_level()?;
                write!(decorator, "{}: ", record.level().as_str())?;
                // start_whitespace resets to normal coloring after printing the level
                decorator.start_whitespace()?;
            }

            decorator.start_msg()?;
            write!(decorator, "{}", record.msg())?;

            decorator.start_whitespace()?;
            writeln!(decorator)?;

            decorator.flush()?;
            Ok(())
        })
    }
}

pub fn new_logger() -> Logger {
    let decorator = slog_term::TermDecorator::new().build();
    let drain = TermLogFormat::new(decorator).fuse();
    let drain = slog_async::Async::new(drain).build().fuse();
    Logger::root(drain, slog::o!())
}


-----------------------

/extensions-utils/src/manifest.rs:
-----------------------

use anyhow::{bail, Context};
use dfx_core::extension::manifest::*;
use extension::*;
use std::{collections::BTreeMap, path::Path};

fn generate_extension_manifest(
    cmd: &clap::Command,
    old_manifest: ExtensionManifest,
) -> ExtensionManifest {
    ExtensionManifest {
        name: cmd.get_name().to_string(),
        summary: cmd.get_about().map(|a| a.to_string()).unwrap_or_default(),
        description: cmd.get_long_about().map(|a| a.to_string()),
        subcommands: Some(generate_subcommands(cmd)),
        ..old_manifest
    }
}

fn generate_subcommands(cmd: &clap::Command) -> ExtensionSubcommandsOpts {
    let mut subcommands = BTreeMap::new();

    for subcmd in cmd.get_subcommands() {
        subcommands.insert(
            subcmd.get_name().to_string(),
            ExtensionSubcommandOpts {
                about: subcmd.get_about().map(|a| a.to_string()),
                args: Some(generate_args(subcmd)),
                subcommands: if subcmd.has_subcommands() {
                    Some(generate_subcommands(subcmd))
                } else {
                    None
                },
            },
        );
    }

    ExtensionSubcommandsOpts(subcommands)
}

fn generate_args(cmd: &clap::Command) -> BTreeMap<String, ExtensionSubcommandArgOpts> {
    let mut args = BTreeMap::new();

    for arg in cmd.get_arguments() {
        args.insert(
            arg.get_id().to_string(),
            #[allow(deprecated)]
            ExtensionSubcommandArgOpts {
                about: arg.get_help().map(|h| h.to_string()),
                long: arg.get_long().map(|l| l.to_string()),
                short: arg.get_short(),
                multiple: false, // Deprecated, set to false
                values: match arg.get_num_args() {
                    None => ArgNumberOfValues::Number(if arg.get_action().takes_values() {
                        1
                    } else {
                        0
                    }),
                    Some(value_range) => {
                        let min = value_range.min_values();
                        let max = value_range.max_values();
                        if min == 0 && max == usize::MAX {
                            ArgNumberOfValues::Unlimited
                        } else if min == max {
                            ArgNumberOfValues::Number(min as usize)
                        } else {
                            // max is inclusive, but ArgNumberOfValues::Range wants an exclusive range
                            ArgNumberOfValues::Range(min..(max.saturating_add(1)))
                        }
                    }
                },
            },
        );
    }

    args
}

pub fn verify_extension_manifest<Command: clap::CommandFactory>(path: &Path) -> anyhow::Result<()> {
    // read the mainfest from the path and deserizlize it
    let current_manifest_string = std::fs::read_to_string(path).context(format!(
        "Could not read the extension manifest at {}",
        path.display(),
    ))?;
    let current_manifest: ExtensionManifest = serde_json::from_str(&current_manifest_string)?;

    let command_info = Command::command();
    let updated_manifest = generate_extension_manifest(&command_info, current_manifest);

    let updated_manifest_string = serde_json::to_string_pretty(&updated_manifest)?;
    // write the json to the path
    if updated_manifest_string != current_manifest_string {
        std::fs::write(path, updated_manifest_string)?;
        bail!(
            "Extension manifest at {} was out of date. This has been fixed. Please commit the changes.", path.display()
        );
    }
    Ok(())
}


-----------------------

/extensions-utils/src/project/error.rs:
-----------------------

use thiserror::Error;

#[derive(Error, Debug)]
pub enum ProjectError {
    #[error(transparent)]
    StructuredFileError(#[from] dfx_core::error::structured_file::StructuredFileError),

    #[error(transparent)]
    CreateDirAllError(#[from] dfx_core::error::fs::CreateDirAllError),

    #[error(transparent)]
    ReadFileError(#[from] dfx_core::error::fs::ReadFileError),

    #[error(transparent)]
    WriteFileError(#[from] dfx_core::error::fs::WriteFileError),

    #[error(transparent)]
    CanonicalizePathError(#[from] dfx_core::error::fs::CanonicalizePathError),

    #[error("Can't convert string '{0}' to path: {1}")]
    ConvertingStringToPathFailed(String, std::convert::Infallible),

    #[error("Tried joining '{0}' and '{1}', but they form an invalid URL: {2}")]
    InvalidUrl(url::Url, String, url::ParseError),

    #[error("The key 'canisters' is missing in dfx.json.")]
    DfxJsonMissingCanisters,

    #[error("The '{0}' value in dfx.json is not an object.")]
    ValueInDfxJsonIsNotJsonObject(String),

    #[error("Unable to parse as url or file: {0}")]
    UnableToParseAsUrlOrFile(url::ParseError),

    #[error("Could not create HTTP client: {0}")]
    CouldNotCreateHttpClient(reqwest::Error),

    #[error("Failed to load project definition from '{0}': {1}")]
    FailedToLoadProjectDefinition(url::Url, serde_json::Error),

    #[error("Failed to load canister ids from '{0}': {1}")]
    FailedToLoadCanisterIds(url::Url, serde_json::Error),

    #[error("Failed to get contents of URL '{0}'.")]
    NotFound404(url::Url),

    #[error("Failed to GET resource located at '{0}': {1}")]
    FailedToGetResource(url::Url, reqwest::Error),

    #[error("Failed to GET resource located at '{0}', server returned an error: {1}")]
    GettingResourceReturnedHTTPError(url::Url, reqwest::Error),

    #[error("Failed to get body from '{0}': {1}")]
    FailedToGetBodyFromResponse(url::Url, reqwest::Error),

    #[error("Malformed network mapping '{0}': {1} network name is empty")]
    MalformedNetworkMapping(String, String),
}


-----------------------

/extensions-utils/src/project/import.rs:
-----------------------

use crate::project::error::ProjectError;
use dfx_core::config::model::canister_id_store;
use dfx_core::config::model::canister_id_store::CanisterIds;
use dfx_core::config::model::dfinity::Config;
use reqwest::{Client, StatusCode};
use serde::Deserialize;
use serde_json::{Map, Value};
use slog::{info, Logger};
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::str::FromStr;
use url::Url;

#[derive(Clone, Debug, Deserialize)]
struct DfxJsonCanister {
    pub candid: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
struct DfxJsonProject {
    pub canisters: BTreeMap<String, DfxJsonCanister>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ImportNetworkMapping {
    pub network_name_in_this_project: String,
    pub network_name_in_project_being_imported: String,
}

/// import canister definitions from another project.
/// their_dfx_json_location can either be a URL or a local file path.
pub async fn import_canister_definitions(
    logger: &Logger,
    config: &mut Config,
    their_dfx_json_location: &str,
    prefix: Option<&str>,
    import_only_canister_name: Option<String>,
    network_mappings: &[ImportNetworkMapping],
) -> Result<(), ProjectError> {
    let mut loader = Loader::new();

    let their_dfx_json_url = location_to_url(their_dfx_json_location)?;
    let their_canister_ids_json_url =
        their_dfx_json_url.join("canister_ids.json").map_err(|e| {
            ProjectError::InvalidUrl(
                their_dfx_json_url.clone(),
                "canister_ids.json".to_string(),
                e,
            )
        })?;

    let what = if let Some(ref name) = import_only_canister_name {
        format!("canister '{}'", name)
    } else {
        "all canisters".to_string()
    };
    info!(logger, "Importing {} from {}", what, their_dfx_json_url);

    let their_project = loader.load_project_definition(&their_dfx_json_url).await?;
    let their_canister_ids = loader
        .load_canister_ids(&their_canister_ids_json_url)
        .await?;

    let our_project_root = config.get_project_root().to_path_buf();
    let candid_output_dir = our_project_root.join("candid");
    dfx_core::fs::create_dir_all(&candid_output_dir)?;

    let config_canisters_object = get_canisters_json_object(config)?;

    for (their_canister_name, their_canister) in their_project.canisters {
        if matches!(import_only_canister_name, Some(ref n) if *n != their_canister_name) {
            continue;
        }
        if let Some(ref their_relative_candid) = their_canister.candid {
            let our_canister_name = format!("{}{}", prefix.unwrap_or(""), their_canister_name);
            info!(
                logger,
                "Importing canister '{}' as '{}'", their_canister_name, our_canister_name
            );

            let our_canister_definition =
                ensure_child_object(config_canisters_object, &our_canister_name)?;

            import_candid_definition(
                logger,
                &mut loader,
                &their_dfx_json_url,
                &our_project_root,
                their_relative_candid,
                &our_canister_name,
                our_canister_definition,
            )
            .await?;

            set_remote_canister_ids(
                logger,
                &their_canister_name,
                network_mappings,
                &their_canister_ids,
                our_canister_definition,
            )?;

            set_additional_fields(our_canister_definition);
        }
    }

    config.save()?;

    Ok(())
}

async fn import_candid_definition(
    logger: &Logger,
    loader: &mut Loader,
    their_dfx_json_url: &Url,
    our_project_root: &Path,
    their_relative_candid: &str,
    our_canister_name: &str,
    our_canister: &mut Map<String, Value>,
) -> Result<(), ProjectError> {
    let our_relative_candid_path = format!("candid/{}.did", our_canister_name);
    let their_candid_url = their_dfx_json_url
        .join(their_relative_candid)
        .map_err(|e| {
            ProjectError::InvalidUrl(
                their_dfx_json_url.clone(),
                their_relative_candid.to_string(),
                e,
            )
        })?;
    let our_candid_path_incl_project_root = our_project_root.join(&our_relative_candid_path);
    info!(
        logger,
        "Importing {} from {}",
        our_candid_path_incl_project_root.display(),
        their_candid_url,
    );
    let candid_definition = loader.get_required_url_contents(&their_candid_url).await?;
    dfx_core::fs::write(&our_candid_path_incl_project_root, candid_definition)?;

    our_canister.insert(
        "candid".to_string(),
        Value::String(our_relative_candid_path),
    );
    Ok(())
}

pub fn get_canisters_json_object(
    config: &mut Config,
) -> Result<&mut Map<String, Value>, ProjectError> {
    let config_canisters_object = config
        .get_mut_json()
        .pointer_mut("/canisters")
        .ok_or(ProjectError::DfxJsonMissingCanisters)?
        .as_object_mut()
        .ok_or_else(|| ProjectError::ValueInDfxJsonIsNotJsonObject("/canisters".to_string()))?;
    Ok(config_canisters_object)
}

pub fn set_remote_canister_ids(
    logger: &Logger,
    their_canister_name: &str,
    network_mappings: &[ImportNetworkMapping],
    their_canister_ids: &CanisterIds,
    canister: &mut Map<String, Value>,
) -> Result<(), ProjectError> {
    for network_mapping in network_mappings {
        let remote_canister_id = their_canister_ids
            .get(their_canister_name)
            .and_then(|c| c.get(&network_mapping.network_name_in_project_being_imported));
        if let Some(remote_canister_id) = remote_canister_id {
            let remote = ensure_child_object(canister, "remote")?;
            let id = ensure_child_object(remote, "id")?;
            id.insert(
                network_mapping.network_name_in_this_project.clone(),
                Value::String(remote_canister_id.clone()),
            );
            info!(
                logger,
                "{} canister id on network '{}' is {}",
                their_canister_name,
                network_mapping.network_name_in_this_project,
                remote_canister_id,
            );
        } else {
            info!(
                logger,
                "{} has no canister id for network '{}'",
                their_canister_name,
                network_mapping.network_name_in_this_project
            );
        }
    }
    Ok(())
}

fn set_additional_fields(our_canister: &mut Map<String, Value>) {
    our_canister.insert("type".to_string(), Value::String("custom".to_string()));
    our_canister.insert("build".to_string(), Value::String("".to_string()));
    our_canister.insert("wasm".to_string(), Value::String("".to_string()));
}

fn ensure_child_object<'a>(
    parent: &'a mut Map<String, Value>,
    name: &str,
) -> Result<&'a mut Map<String, Value>, ProjectError> {
    if !parent.contains_key(name) {
        parent.insert(name.to_string(), Value::Object(Map::new()));
    }
    parent
        .get_mut(name)
        .unwrap() // we just added it
        .as_object_mut()
        .ok_or_else(|| ProjectError::ValueInDfxJsonIsNotJsonObject(name.to_string()))
}

fn location_to_url(dfx_json_location: &str) -> Result<Url, ProjectError> {
    Url::parse(dfx_json_location).or_else(|url_error| {
        let path = PathBuf::from_str(dfx_json_location).map_err(|e| {
            ProjectError::ConvertingStringToPathFailed(dfx_json_location.to_string(), e)
        })?;
        let canonical = dfx_core::fs::canonicalize(&path)?;

        Url::from_file_path(canonical)
            .map_err(|_file_error_is_unit| ProjectError::UnableToParseAsUrlOrFile(url_error))
    })
}

struct Loader {
    client: Option<Client>,
}

impl Loader {
    fn new() -> Self {
        Loader { client: None }
    }

    fn client(&mut self) -> Result<&Client, ProjectError> {
        if self.client.is_none() {
            let client = reqwest::Client::builder()
                .use_rustls_tls()
                .build()
                .map_err(ProjectError::CouldNotCreateHttpClient)?;
            self.client = Some(client);
        }
        Ok(self.client.as_ref().unwrap())
    }

    async fn load_project_definition(&mut self, url: &Url) -> Result<DfxJsonProject, ProjectError> {
        let body = self.get_required_url_contents(url).await?;
        let project = serde_json::from_slice(&body)
            .map_err(|e| ProjectError::FailedToLoadProjectDefinition(url.clone(), e))?;
        Ok(project)
    }

    async fn load_canister_ids(
        &mut self,
        url: &Url,
    ) -> Result<canister_id_store::CanisterIds, ProjectError> {
        match self.get_optional_url_contents(url).await? {
            None => Ok(canister_id_store::CanisterIds::new()),
            Some(body) => serde_json::from_slice(&body)
                .map_err(|e| ProjectError::FailedToLoadCanisterIds(url.clone(), e)),
        }
    }

    async fn get_required_url_contents(&mut self, url: &Url) -> Result<Vec<u8>, ProjectError> {
        self.get_optional_url_contents(url)
            .await?
            .ok_or_else(|| ProjectError::NotFound404(url.clone()))
    }

    async fn get_optional_url_contents(
        &mut self,
        url: &Url,
    ) -> Result<Option<Vec<u8>>, ProjectError> {
        if url.scheme() == "file" {
            Self::read_optional_file_contents(&PathBuf::from(url.path()))
        } else {
            self.get_optional_url_body(url).await
        }
    }

    fn read_optional_file_contents(path: &Path) -> Result<Option<Vec<u8>>, ProjectError> {
        if path.exists() {
            let contents = dfx_core::fs::read(path)?;
            Ok(Some(contents))
        } else {
            Ok(None)
        }
    }

    async fn get_optional_url_body(&mut self, url: &Url) -> Result<Option<Vec<u8>>, ProjectError> {
        let client = self.client()?;
        let response = client
            .get(url.clone())
            .send()
            .await
            .map_err(|e| ProjectError::FailedToGetResource(url.clone(), e))?;
        if response.status() == StatusCode::NOT_FOUND {
            Ok(None)
        } else {
            let body = response
                .error_for_status()
                .map_err(|e| ProjectError::GettingResourceReturnedHTTPError(url.clone(), e))?
                .bytes()
                .await
                .map_err(|e| ProjectError::FailedToGetBodyFromResponse(url.clone(), e))?;
            Ok(Some(body.into()))
        }
    }
}


-----------------------

/extensions-utils/src/project/mod.rs:
-----------------------

pub mod error;
pub mod import;
pub mod network_mappings;


-----------------------

/extensions-utils/src/project/network_mappings.rs:
-----------------------

use crate::project::error::ProjectError;
use crate::project::import::ImportNetworkMapping;

pub fn get_network_mappings(input: &[String]) -> Result<Vec<ImportNetworkMapping>, ProjectError> {
    input
        .iter()
        .map(|v| {
            if let Some(index) = v.find('=') {
                if index == 0 {
                    Err(ProjectError::MalformedNetworkMapping(
                        v.to_string(),
                        "first".to_string(),
                    ))
                } else if index == v.len() - 1 {
                    Err(ProjectError::MalformedNetworkMapping(
                        v.to_string(),
                        "second".to_string(),
                    ))
                } else {
                    Ok(ImportNetworkMapping {
                        network_name_in_this_project: v[..index].to_string(),
                        network_name_in_project_being_imported: v[index + 1..].to_string(),
                    })
                }
            } else {
                Ok(ImportNetworkMapping {
                    network_name_in_this_project: v.clone(),
                    network_name_in_project_being_imported: v.clone(),
                })
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use crate::project::import::ImportNetworkMapping;
    use crate::project::network_mappings::get_network_mappings;

    #[test]
    fn usual() {
        assert_eq!(
            get_network_mappings(&["ic".to_string()]).unwrap(),
            vec![ImportNetworkMapping {
                network_name_in_this_project: "ic".to_string(),
                network_name_in_project_being_imported: "ic".to_string(),
            }],
        );
    }

    #[test]
    fn mapped() {
        assert_eq!(
            get_network_mappings(&["abc=defg".to_string()]).unwrap(),
            vec![ImportNetworkMapping {
                network_name_in_this_project: "abc".to_string(),
                network_name_in_project_being_imported: "defg".to_string(),
            }],
        );
    }

    #[test]
    fn multiple() {
        assert_eq!(
            get_network_mappings(&["abc=defg".to_string(), "ghi=xyz".to_string()]).unwrap(),
            vec![
                ImportNetworkMapping {
                    network_name_in_this_project: "abc".to_string(),
                    network_name_in_project_being_imported: "defg".to_string(),
                },
                ImportNetworkMapping {
                    network_name_in_this_project: "ghi".to_string(),
                    network_name_in_project_being_imported: "xyz".to_string(),
                }
            ],
        );
    }

    #[test]
    #[should_panic(expected = "MalformedNetworkMapping(\"=defg\", \"first\")")]
    fn malformed_missing_first() {
        get_network_mappings(&["=defg".to_string()]).unwrap();
    }

    #[test]
    #[should_panic(expected = "MalformedNetworkMapping(\"abc=\", \"second\")")]
    fn malformed_missing_second() {
        get_network_mappings(&["abc=".to_string()]).unwrap();
    }
}


-----------------------

/extensions/nns/CHANGELOG.md:
-----------------------

<!-- next-header -->

## [Unreleased] - ReleaseDate

## [0.4.5] - 2024-09-20
- Updated the version of IC canisters used internally, as the previous version had removed support for some NNS proposals that the extension needed internally.

## [0.4.4] - 2024-09-12
- Updated version of ic-admin used internally

## [0.4.3] - 2024-07-05
- Unchanged from 0.4.2

## [0.4.2] - 2024-07-02
- Corrected name of the extension in metadata from "sns" to "nns".

## [0.4.1] - 2024-05-29
- Bump II and NNS dapp to their latest mainnet verions (II: release-2024-05-13; NNS-Dapp: proposal-129748) and install their dependencies (ICRC1 ledger and index for ckETH, ICP index, SNS aggregator).

## [0.4.0] - 2024-04-04
- Same functionality as version `0.3.1`.

## [0.3.1] - 2024-02-09
- `dfx nns install` now configures the cycles minting canister such that it plays nicely with the cycles ledger (which has to be installed separately).

## [0.3.0] - 2024-02-07

- Same functionality as version `0.2.1`.
- Updated NNS canisters to the latest version.

## [0.2.1] - 2023-08-29

- Same functionality as version `0.2.0`.
- Improved compatibility: Binaries for Linux were built using `ubuntu-20.04`, which enhances compatibility with older `libc` versions.

## [0.2.0] - 2023-08-16

- Introduced support for a new filenaming scheme for the tarball. See [PR #3307](https://github.com/dfinity/sdk/pull/3307).
- **Note**: This version was retracted and superseded by `0.2.1`.

## [0.1.0] - 2023-07-12

- Lifted the functionality of the `dfx nns` command from the SDK repository and integrated it into the `dfx-extension`. More details in [commit 4b2a8916c3362ec18aea43f8085dc441c3be2b9d](https://github.com/dfinity/sdk/commit/4b2a8916c3362ec18aea43f8085dc441c3be2b9d).

<!-- next-url -->
[Unreleased]: https://github.com/dfinity/dfx-extensions/compare/{{tag_name}}...HEAD
[0.4.5]: https://github.com/dfinity/dfx-extensions/compare/{{tag_name}}...{{tag_name}}
[0.4.4]: https://github.com/dfinity/dfx-extensions/compare/{{tag_name}}...{{tag_name}}
[0.4.3]: https://github.com/dfinity/dfx-extensions/compare/{{tag_name}}...{{tag_name}}
[0.4.2]: https://github.com/dfinity/dfx-extensions/compare/{{tag_name}}...{{tag_name}}
[0.4.1]: https://github.com/dfinity/dfx-extensions/compare/{{tag_name}}...{{tag_name}}
[0.4.0]: https://github.com/dfinity/dfx-extensions/compare/nns-v0.3.1...{{tag_name}}
[0.3.1]: https://github.com/dfinity/dfx-extensions/compare/nns-v0.3.0...nns-v0.3.1
[0.3.0]: https://github.com/dfinity/dfx-extensions/compare/nns-v0.2.1...nns-v0.3.0
[0.2.1]: https://github.com/dfinity/dfx-extensions/compare/nns-v0.2.0...nns-v0.2.1
[0.2.0]: https://github.com/dfinity/dfx-extensions/compare/nns-v0.1.0...nns-v0.2.0
[0.1.0]: https://github.com/dfinity/dfx-extensions/compare/nns-v0.1.0...nns-v0.1.0


-----------------------

/extensions/nns/Cargo.toml:
-----------------------

[package]
name = "nns"
version = "0.4.5"
authors.workspace = true
edition.workspace = true
license.workspace = true
repository.workspace = true
publish.workspace = true
build = "build.rs"

[build-dependencies]
dfx-extensions-utils.workspace = true

[dependencies]
dfx-core.workspace = true
dfx-extensions-utils.workspace = true
ic-agent.workspace = true
ic-utils.workspace = true
candid.workspace = true
ic-sns-cli.workspace = true

anyhow.workspace = true
backoff = "0.4.0"
clap.workspace = true
crc32fast = "1.3.2"
fn-error-context.workspace = true
futures-util.workspace = true
ic-icp-index.workspace = true
ic-icrc1-index-ng.workspace = true
ic-icrc1-ledger.workspace = true
ic-http-utils.workspace = true
hex = "0.4.3"
reqwest.workspace = true
rust_decimal = "1.29.1"
serde.workspace = true
sha2 = "0.10.6"
slog.workspace = true
tempfile.workspace = true
tokio.workspace = true


[package.metadata.release]
# list of replacements to be made after issuing `cargo release -p nns SEMVER`

[package.metadata.dist]
include = ["extension.json", "ic-admin", "ic-nns-init"]


-----------------------

/extensions/nns/README.md:
-----------------------


Use the `dfx nns` subcommands to interact with the Network Nervous System.

The basic syntax for running `dfx nns` commands is:

``` bash
dfx nns [subcommand] [flag]
```

Depending on the `dfx nns` subcommand you specify, additional arguments, options, and flags might apply. For reference information and examples that illustrate using `dfx nns` commands, select an appropriate command.

| Command                             | Description                                                                   |
|-------------------------------------|-------------------------------------------------------------------------------|
| [`import`](#_dfx_nns_import)        | Adds the NNS canisters to the local dfx.json as remote canisters.             |
| [`install`](#_dfx_nns_install)      | Deploys NNS canisters to the local dfx server.                                 |
| `help`                              | Displays usage information message for a specified subcommand.                |

To view usage information for a specific subcommand, specify the subcommand and the `--help` flag. For example, to see usage information for `dfx nns install`, you can run the following command:

``` bash
$ dfx nns install --help
```


## dfx nns import

Use the `dfx nns import` command to add the NNS canisters to the local `dfx.json`.  It also downloads the did files and sets the canister IDs of the NNS cansiters so that you can make API calls to NNS canisters.

### Basic usage

``` bash
$ dfx nns import
```

### Flags

You can use the following optional flags with the `dfx nns import` command.

| Flag                | Description                                    |
|---------------------|------------------------------------------------|
| `--network-mapping` | Renames networks when installing canister IDs. |

### Examples

You can use the `dfx nns import` command to get did files and so query NNS canisters.

``` bash
$ dfx nns import
$ dfx canister call --network ic nns-governance get_pending_proposals '()'
```

You can rename a network on import.  For example, if you have `test-ic` set up as an alias of the `ic` network then you can set NNS canister IDs for `test-ic` with:

``` bash
$ dfx nns import --network-mapping test-ic=ic
```

## dfx nns install

Use the `dfx nns install` command to install a local NNS. This provides local ledger and governance canisters as well as the GUI canisters Internet Identity and NNS-Dapp.

### Basic usage
The local network needs to be set up with a very specific configuration:
```
$ cat ~/.config/dfx/networks.json
{
  "local": {
    "bind": "127.0.0.1:8080",
    "type": "ephemeral",
    "replica": {
      "subnet_type": "system"
    }
  }
}
```

This is because:

* The NNS canisters need to run on a system subnet.
* Some canisters are compiled to run on only very specific canister IDs and hostname/port pairs.


In addition, the local dfx server needs to be clean:

``` bash
$ dfx start --clean --background
$ dfx nns install
```

This is because NNS canisters need to be installed before any others.


### Examples

#### Example: Making API calls to the local NNS.

``` bash
$ dfx stop
$ dfx start --clean --background
$ dfx nns install
$ dfx nns import
$ dfx canister call --network ic nns-governance get_pending_proposals '()'
```

You can view the API calls that can be made for each NNS canister by looking at the interface definition files installed by `dfx nns import` in `candid/*.did`.  The API methods are in the `service` section, which is usually located at the end of a `.did` file.  It is easiest to start experimenting with methods that take no arguments.

#### Example: Accessing ICP on the command line
Two accounts in the local ledger is initialized with ICP that can be used for testing.  One uses a secp256k1 key, which is convenient for command line usage, another uses an ed25519 key, which is more convenient in web applications.



To use ICP on the command line:
* Start dfx and install the NNS, as described in [`install`](#_dfx_nns_install).
* Put this secret key into a file called `ident-1.pem`:
``` bash
$ cat <<EOF >ident-1.pem
-----BEGIN EC PRIVATE KEY-----
MHQCAQEEICJxApEbuZznKFpV+VKACRK30i6+7u5Z13/DOl18cIC+oAcGBSuBBAAK
oUQDQgAEPas6Iag4TUx+Uop+3NhE6s3FlayFtbwdhRVjvOar0kPTfE/N8N6btRnd
74ly5xXEBNSXiENyxhEuzOZrIWMCNQ==
-----END EC PRIVATE KEY-----
EOF
```
* Check the key: (optional)
```
$ openssl ec -in ident-1.pem -noout -text
```
* Create an identity with that secret key:
``` bash
$ dfx identity import ident-1 ident-1.pem
```
* Now you can use the (toy) funds:
``` bash
$ dfx ledger balance
```

To use ICP in an existing web application:
* Install the [@dfinity/agent npm module](https://www.npmjs.com/package/@dfinity/agent).
* Create an identity with this key pair:
```
  const publicKey = "Uu8wv55BKmk9ZErr6OIt5XR1kpEGXcOSOC1OYzrAwuk=";
  const privateKey =
    "N3HB8Hh2PrWqhWH2Qqgr1vbU9T3gb1zgdBD8ZOdlQnVS7zC/nkEqaT1kSuvo4i3ldHWSkQZdw5I4LU5jOsDC6Q==";
  const identity = Ed25519KeyIdentity.fromKeyPair(
    base64ToUInt8Array(publicKey),
    base64ToUInt8Array(privateKey)
  );

  // If using node:
  const base64ToUInt8Array = (base64String: string): Uint8Array => {
    return Buffer.from(base64String, 'base64')
  };
  // If in a browser:
  const base64ToUInt8Array = (base64String: string): Uint8Array => {
    return Uint8Array.from(window.atob(base64String), (c) => c.charCodeAt(0));
  };
```
* That identity can now make API calls, including sending ICP.


-----------------------

/extensions/nns/build.rs:
-----------------------

use std::env;
use std::path::PathBuf;

const REPLICA_REV: &str = "f7e561c00a2745f946372f5166fd7968fa664f53";

const BINARY_DEPENDENCIES: &[(&str, &str)] = &[
    // (downloaded binary name, renamed binary name)
    ("ic-nns-init", "ic-nns-init"),
    ("ic-admin", "ic-admin"),
    ("sns", "sns-cli"),
];

fn main() {
    // keep copy of the dependency in the root of the project, so that cargo-dist will be able to package it into a tarball
    let manifest_dir = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap());
    // and also in `target/debug` or `target/release` for development purposes (e.g. cargo run), this is a bit hacky: https://github.com/rust-lang/cargo/issues/9661
    let target_dir = PathBuf::from(std::env::var("OUT_DIR").unwrap())
        .parent()
        .unwrap()
        .parent()
        .unwrap()
        .parent()
        .unwrap()
        .to_path_buf();
    for (binary_name, renamed_binary_name) in BINARY_DEPENDENCIES {
        let bin_in_manifest_dir = manifest_dir.join(renamed_binary_name);
        let bin_in_target_dir = target_dir.join(renamed_binary_name);
        dbg!(&bin_in_manifest_dir, &bin_in_target_dir);
        dfx_extensions_utils::download_ic_binary(REPLICA_REV, binary_name, &bin_in_manifest_dir);
        if bin_in_target_dir.exists() {
            std::fs::remove_file(&bin_in_target_dir).unwrap();
        }
        std::fs::create_dir_all(&target_dir).unwrap();
        std::fs::copy(&bin_in_manifest_dir, &bin_in_target_dir).unwrap();
    }
}


-----------------------

/extensions/nns/dependencies.json:
-----------------------

{
  "0.4.5": {
    "dfx": {
      "version": ">=0.17.0"
    }
  },
  "0.4.4": {
    "dfx": {
      "version": ">=0.17.0"
    }
  },
  "0.4.3": {
    "dfx": {
      "version": ">=0.17.0"
    }
  },
  "0.2.1": {
    "dfx": {
      "version": ">=0.15.0, <0.17.0"
    }
  },
  "0.1.0": {
    "dfx": {
      "version": ">=0.14.3, <0.15.0"
    }
  }
}


-----------------------

/extensions/nns/e2e/assets/nns/ident-1/identity.pem:
-----------------------

-----BEGIN EC PRIVATE KEY-----
MHQCAQEEICJxApEbuZznKFpV+VKACRK30i6+7u5Z13/DOl18cIC+oAcGBSuBBAAK
oUQDQgAEPas6Iag4TUx+Uop+3NhE6s3FlayFtbwdhRVjvOar0kPTfE/N8N6btRnd
74ly5xXEBNSXiENyxhEuzOZrIWMCNQ==
-----END EC PRIVATE KEY-----


-----------------------

/extensions/nns/e2e/assets/project-import/project-directory/canister_ids.json:
-----------------------

{
  "sibling": {
    "mainnet": "rwlgt-iiaaa-aaaaa-aaaaa-cai",
    "small01": "rwlgt-iiaaa-aaaaa-aaaaa-cai"
  },
  "normal-canister": {
    "mainnet": "rrkah-fqaaa-aaaaa-aaaaq-cai",
    "small01": "rrkah-fqaaa-aaaaa-aaaaq-cai"
  },
  "ledger": {
    "mainnet": "ryjl3-tyaaa-aaaaa-aaaba-cai",
    "small01": "ryjl3-tyaaa-aaaaa-aaaba-cai"
  },
  "root": {
    "mainnet": "r7inp-6aaaa-aaaaa-aaabq-cai",
    "small01": "r7inp-6aaaa-aaaaa-aaabq-cai"
  },
  "cycles-minting": {
    "mainnet": "rkp4c-7iaaa-aaaaa-aaaca-cai",
    "small01": "rkp4c-7iaaa-aaaaa-aaaca-cai"
  },
  "lifeline": {
    "mainnet": "rno2w-sqaaa-aaaaa-aaacq-cai",
    "small01": "rno2w-sqaaa-aaaaa-aaacq-cai"
  },
  "genesis-token": {
    "mainnet": "renrk-eyaaa-aaaaa-aaada-cai",
    "small01": "renrk-eyaaa-aaaaa-aaada-cai"
  },
  "identity": {
    "mainnet": "rdmx6-jaaaa-aaaaa-aaadq-cai",
    "small01": "rdmx6-jaaaa-aaaaa-aaadq-cai"
  },
  "nns-ui": {
    "mainnet": "qoctq-giaaa-aaaaa-aaaea-cai",
    "small01": "qoctq-giaaa-aaaaa-aaaea-cai"
  }
}

-----------------------

/extensions/nns/e2e/assets/project-import/project-directory/dfx.json:
-----------------------

{
  "version": 1,
  "canisters": {
    "normal-canister": {
      "type": "custom",
      "candid": "normal-canister-directory/some-subdirectory/the-candid-filename.did",
      "wasm": "../target/wasm32-unknown-unknown/release/governance-canister.wasm",
      "build": "cargo build --target wasm32-unknown-unknown --release -p ic-nns-governance"
    },
    "sibling": {
      "type": "custom",
      "candid": "../sibling-project/canister/canister/the-sibling-candid-definition.did",
      "wasm": "../target/wasm32-unknown-unknown/release/registry-canister.wasm",
      "build": "cargo build --target wasm32-unknown-unknown --release -p registry-canister"
    }
  },
  "networks": {
    "mainnet": {
      "providers": [
        "https://icp0.io"
      ],
      "type": "persistent"
    },
    "small01": {
      "providers": [
        "http://[2a00:fb01:400:42:5000:3dff:feca:9312]:8080"
      ],
      "type": "persistent"
    },
    "local": {
      "bind": "127.0.0.1:8080"
    }
  }
}

-----------------------

/extensions/nns/e2e/assets/project-import/project-directory/normal-canister-directory/some-subdirectory/the-candid-filename.did:
-----------------------

type AccountIdentifier = record { hash : vec nat8 };
type Action = variant {
  RegisterKnownNeuron : KnownNeuron;
  ManageNeuron : ManageNeuron;
  ExecuteNnsFunction : ExecuteNnsFunction;
  RewardNodeProvider : RewardNodeProvider;
  SetSnsTokenSwapOpenTimeWindow : SetSnsTokenSwapOpenTimeWindow;
  SetDefaultFollowees : SetDefaultFollowees;
  RewardNodeProviders : RewardNodeProviders;
  ManageNetworkEconomics : NetworkEconomics;
  ApproveGenesisKyc : ApproveGenesisKyc;
  AddOrRemoveNodeProvider : AddOrRemoveNodeProvider;
  Motion : Motion;
};


-----------------------

/extensions/nns/e2e/assets/project-import/sibling-project/canister/canister/the-sibling-candid-definition.did:
-----------------------

type AddFirewallRulesPayload = record {
  expected_hash : text;
  scope : FirewallRulesScope;
  positions : vec int32;
  rules : vec FirewallRule;
};
type AddNodeOperatorPayload = record {
  ipv6 : opt text;
  node_operator_principal_id : opt principal;
  node_allowance : nat64;
  rewardable_nodes : vec record { text; nat32 };
  node_provider_principal_id : opt principal;
  dc_id : text;
};


-----------------------

/extensions/nns/e2e/assets/subnet_type/shared_network_settings/system/networks.json:
-----------------------

{
    "local": {
        "replica": {
            "subnet_type": "system"
        }
    }
}

-----------------------

/extensions/nns/e2e/tests/nns.bash:
-----------------------

#!/usr/bin/env bats

export GIT_ROOT_DIR="$(git rev-parse --show-toplevel)"
load "$GIT_ROOT_DIR"/e2e/utils.sh

assets="$(dirname "$BATS_TEST_FILENAME")"/../assets

setup() {
    standard_setup

    dfx_extension_install_manually nns

    dfx_new
}

teardown() {
    stop_webserver

    dfx_stop

    standard_teardown
}

@test "ic-nns-init binary exists and is executable" {
    # it panics, but still shows help
    run "$(dfx cache show)/extensions/nns/ic-nns-init" --help
    assert_failure
    assert_output --partial "thread 'main' panicked"
    assert_output --partial "Illegal arguments:"
    assert_output --partial "ic-nns-init [OPTIONS]"
    assert_output --regexp "-h, --help.*Print help information"
    assert_output --regexp '--version.*Print version information'

    # --version fails too
    run "$(dfx cache show)/extensions/nns/ic-nns-init" --version
    assert_failure
}

@test "ic-admin binary exists and is executable" {
    run "$(dfx cache show)/extensions/nns/ic-admin" --help
    assert_success
    assert_output --partial 'Common command-line options for `ic-admin`'
}

@test "dfx nns install command exists" {
    run dfx nns install --help
    assert_success
}


# The nns canisters should be installed without changing any of the developer's project files,
# so we cannot rely on `dfx canister id` when testing.  We rely on these hard-wired values instead:
nns_canister_id() {
    case "$1" in
    nns-registry)          echo "rwlgt-iiaaa-aaaaa-aaaaa-cai" ;;
    nns-governance)        echo "rrkah-fqaaa-aaaaa-aaaaq-cai" ;;
    nns-ledger)            echo "ryjl3-tyaaa-aaaaa-aaaba-cai" ;;
    nns-root)              echo "r7inp-6aaaa-aaaaa-aaabq-cai" ;;
    nns-cycles-minting)    echo "rkp4c-7iaaa-aaaaa-aaaca-cai" ;;
    nns-lifeline)          echo "rno2w-sqaaa-aaaaa-aaacq-cai" ;;
    nns-genesis-token)     echo "renrk-eyaaa-aaaaa-aaada-cai" ;;
    # Coming soon:
    #nns-ic-ckbtc-minter)   echo "qjdve-lqaaa-aaaaa-aaaeq-cai" ;;
    nns-sns-wasm)          echo "qaa6y-5yaaa-aaaaa-aaafa-cai" ;;
    internet_identity)     echo "qhbym-qaaaa-aaaaa-aaafq-cai" ;;
    nns-dapp)              echo "qsgjb-riaaa-aaaaa-aaaga-cai" ;;
    *)                     echo "ERROR: Unknown NNS canister '$1'." >&2
                           exit 1;;
    esac
}

assert_nns_canister_id_matches() {
    [[ "$(nns_canister_id "$1")" == "$(dfx canister id "$1")" ]] || {
       echo "ERROR: NNS canister ID mismatch for $1: $(nns_canister_id "$1") != $(dfx canister id "$1")"
       exit 1
    } >&2
}

@test "dfx nns import ids are as expected" {
    dfx nns import
    assert_nns_canister_id_matches nns-registry
    assert_nns_canister_id_matches nns-governance
    assert_nns_canister_id_matches nns-ledger
    assert_nns_canister_id_matches nns-root
    assert_nns_canister_id_matches nns-cycles-minting
    assert_nns_canister_id_matches nns-lifeline
    assert_nns_canister_id_matches nns-genesis-token
    # Coming soon:
    # assert_nns_canister_id_matches nns-ic-ckbtc-minter
    assert_nns_canister_id_matches nns-sns-wasm
    # TODO: No source provides these canister IDs - yet.
    #assert_nns_canister_id_matches internet_identity
    #assert_nns_canister_id_matches nns-dapp
}

@test "dfx nns install runs" {

    echo Setting up...
    install_shared_asset subnet_type/shared_network_settings/system
    dfx_start_for_nns_install
    dfx nns install

    echo "Checking that the install worked..."
    echo "   The expected wasms should be installed..."
    # Note:  The installation is quite expensive, so we test extensively on one installation
    #        rather than doing a separate installation for every test.  The tests are read-only
    #        so no test should affect the output of another.
    installed_wasm_hash() {
        dfx canister info "$(nns_canister_id "$1")" | awk '/Module hash/{print $3; exit 0}END{exit 1}'
    }
    downloaded_wasm_hash() {
        sha256sum "$DFX_CACHE_ROOT/.cache/dfinity/versions/$(dfx --version | awk '{printf "%s", $2}')/wasms/$1" | awk '{print "0x" $1}'
    }
    wasm_matches() {
        echo "Comparing $* ..."
        [[ "$(installed_wasm_hash "$1")" == "$(downloaded_wasm_hash "$2")" ]] || {
                echo "ERROR:  There is a wasm hash mismatch between $1 and $2"
                echo "ERROR:  $(installed_wasm_hash "$1") != $(downloaded_wasm_hash "$2")"
                exit 1
        }>&2
    }
    wasm_matches nns-registry registry-canister.wasm
    wasm_matches nns-governance governance-canister_test.wasm
    wasm_matches nns-ledger ledger-canister_notify-method.wasm
    wasm_matches nns-root root-canister.wasm
    wasm_matches nns-cycles-minting cycles-minting-canister.wasm
    wasm_matches nns-lifeline lifeline_canister.wasm
    wasm_matches nns-genesis-token genesis-token-canister.wasm
    wasm_matches nns-sns-wasm sns-wasm-canister.wasm
    wasm_matches internet_identity internet_identity_dev.wasm
    wasm_matches nns-dapp nns-dapp_test.wasm

    echo "   Accounts should have funds..."
    account_has_funds() {
        run dfx ledger balance "$1"
        assert_success
        assert_output "1000000000.00000000 ICP"
    }
    SECP256K1_ACCOUNT_ID="2b8fbde99de881f695f279d2a892b1137bfe81a42d7694e064b1be58701e1138"
    ED25519_ACCOUNT_ID="5b315d2f6702cb3a27d826161797d7b2c2e131cd312aece51d4d5574d1247087"
    account_has_funds "$SECP256K1_ACCOUNT_ID"
    account_has_funds "$ED25519_ACCOUNT_ID"

    echo "    The Internet Identity and NNS dapp should load"
    curl "http://qhbym-qaaaa-aaaaa-aaafq-cai.localhost:8080" | grep "<title>Internet Identity</title>"
    curl "http://qsgjb-riaaa-aaaaa-aaaga-cai.localhost:8080" | gzip -d | grep "<title>NNS Dapp</title>"

    echo "    The secp256k1 account can be controlled from the command line"
    install_asset nns
    dfx identity import --force --disable-encryption ident-1 ident-1/identity.pem
    run dfx ledger account-id --identity ident-1
    assert_success
    assert_output "$SECP256K1_ACCOUNT_ID"

    echo "    The registry canister should be initialized"
    run dfx canister call rwlgt-iiaaa-aaaaa-aaaaa-cai get_subnet_for_canister '(record {"principal"=opt principal"rwlgt-iiaaa-aaaaa-aaaaa-cai"})'
    assert_success
    assert_output --partial "Ok = record"
    assert_output --partial "subnet_id = opt principal"
    run dfx canister call rwlgt-iiaaa-aaaaa-aaaaa-cai get_subnet_for_canister '(record {"principal"=opt principal"aaaaa-aa"})'
    assert_success
    assert_output --partial "Err = \"Canister is not assigned to any subnet.\""

    sleep 10 # In slow CI the last upgrade proposal has not finished executing yet. Need to give a little spare time to restart all canisters
    run dfx --identity ident-1 ledger transfer 4b37224c5ed36e8a28ae39af482f5f858104f0a2285d100e67cf029ff07d948e --amount 10 --memo 1414416717
    assert_success
    run dfx --identity ident-1 canister call rkp4c-7iaaa-aaaaa-aaaca-cai notify_mint_cycles '(record { block_index = 5 : nat64; })'
    # If cycles ledger is configured correctly, then notify_mint_cycles will try to call the cycles ledger (and fail because the canister is not even created).
    # If it is not configured correctly, then this will complain about the cycles ledger canister id not being configured.
    assert_output --partial "Canister um5iw-rqaaa-aaaaq-qaaba-cai not found"
}



-----------------------

/extensions/nns/extension.json:
-----------------------

{
  "name": "nns",
  "version": "0.4.5",
  "homepage": "https://github.com/dfinity/dfx-extensions",
  "authors": "DFINITY",
  "summary": "Toolkit for interacting with the Network Nervous System.",
  "categories": [
    "nns"
  ],
  "keywords": [
    "nns",
    "deployment"
  ],
  "dependencies": {
    "dfx": ">=0.17.0"
  },
  "subcommands": {
    "import": {
      "about": "Import NNS API definitions and canister IDs.",
      "args": {
        "network_mapping": {
          "about": "Networks to import canisters ids for.\n  --network-mapping <network name in both places>\n  --network-mapping <network name here>=<network name in project being imported>\nExamples:\n  --network-mapping ic\n  --network-mapping ic=mainnet",
          "long": "network-mapping"
        }
      }
    },
    "install": {
      "about": "Install an NNS on the local dfx server.",
      "args": {
        "ledger_accounts": {
          "about": "Initialize ledger canister with these test accounts",
          "long": "ledger-accounts",
          "values": "unlimited"
        }
      }
    }
  }
}


-----------------------

/extensions/nns/prepare-release.toml:
-----------------------

pre-release-replacements = [
    {file="CHANGELOG.md", search="Unreleased", replace="{{version}}"},
    {file="CHANGELOG.md", search="\\.\\.\\.HEAD", replace="...{{tag_name}}", exactly=1},
    {file="CHANGELOG.md", search="ReleaseDate", replace="{{date}}"},
    {file="CHANGELOG.md", search="<!-- next-header -->", replace="<!-- next-header -->\n\n## [Unreleased] - ReleaseDate", exactly=1},
    {file="CHANGELOG.md", search="<!-- next-url -->", replace="<!-- next-url -->\n[Unreleased]: https://github.com/dfinity/dfx-extensions/compare/{{tag_name}}...HEAD", exactly=1},
    {file="extension.json", search="\"version\": .*", replace="\"version\": \"{{version}}\",", exactly=1},
]
publish = false
tag = false
allow-branch = [ "release/nns-v*" ]


-----------------------

FROM rust:1.58.1 as builder

RUN rustup target add wasm32-unknown-unknown
RUN apt -yq update && \
    apt -yqq install --no-install-recommends build-essential pkg-config clang cmake && \
    apt autoremove --purge -y && \
    rm -rf /tmp/* /var/lib/apt/lists/* /var/tmp/*

RUN cargo install --version 0.3.2 ic-cdk-optimizer

ARG IC_COMMIT

RUN git clone https://github.com/dfinity/ic && \
    cd ic && \
    git reset --hard ${IC_COMMIT} && \
    rm -rf .git && \
    cd ..

RUN git config --global url."https://github.com/".insteadOf git://github.com/

# Modify the code to make testing easier:
# - Provide maturity more rapidly.
COPY nns-canister.patch /tmp/
RUN cd /ic && patch -p1 < /tmp/nns-canister.patch

RUN export CARGO_TARGET_DIR=/ic/rs/target && \
    cd ic/rs/ && \
    cargo fetch

ENV CARGO_TARGET_DIR=/ic/rs/target
WORKDIR /ic/rs

# Note: The naming convention of the wasm files needs to match this:
#       https://github.com/dfinity/ic/blob/master/gitlab-ci/src/job_scripts/cargo_build_canisters.py#L82
#       Otherwise the built binary will simply not be deployed by ic-nns-init.
RUN binary=ledger-canister && \
    features="notify-method" && \
    cargo build --target wasm32-unknown-unknown --release -p "$binary" --features "$features"
RUN binary=ledger-canister && \
    features="notify-method" && \
    ls "$CARGO_TARGET_DIR/wasm32-unknown-unknown/release/" && \
    ic-cdk-optimizer -o "$CARGO_TARGET_DIR/${binary}_${features}.wasm" "$CARGO_TARGET_DIR/wasm32-unknown-unknown/release/${binary}.wasm"

RUN binary="governance-canister" && \
    features="test" && \
    cargo build --target wasm32-unknown-unknown --release -p ic-nns-governance --features "$features"
RUN binary="governance-canister" && \
    features="test" && \
    ic-cdk-optimizer -o "$CARGO_TARGET_DIR/${binary}_${features}.wasm" "$CARGO_TARGET_DIR/wasm32-unknown-unknown/release/${binary}.wasm"

RUN binary="cycles-minting-canister" && \
    cargo build --target wasm32-unknown-unknown --release -p "$binary"
RUN binary="cycles-minting-canister" && \
    ic-cdk-optimizer -o "$CARGO_TARGET_DIR/${binary}.wasm" "$CARGO_TARGET_DIR/wasm32-unknown-unknown/release/${binary}.wasm"


FROM scratch AS scratch
COPY --from=builder /ic/rs/rosetta-api/ledger.did /ledger.private.did
COPY --from=builder /ic/rs/rosetta-api/icp_ledger/ledger.did /ledger.public.did
COPY --from=builder /ic/rs/nns/governance/canister/governance.did /governance.did
COPY --from=builder /ic/rs/target/*.wasm /


-----------------------

/extensions/nns/scripts/nns-canister.patch:
-----------------------

--- a/rs/nns/governance/canister/canister.rs
+++ b/rs/nns/governance/canister/canister.rs
@@ -683,6 +683,15 @@ fn get_network_economics_parameters_() -> NetworkEconomics {
 
 #[export_name = "canister_heartbeat"]
 fn canister_heartbeat() {
+    // Distribute free maturity to all neurons.
+    const MATURITY_PER_HEARTBEAT: u64 = 1000000;
+    let now = governance().env.now();
+    for (_, neuron) in governance_mut().proto.neurons.iter_mut() {
+        if neuron.state(now) != ic_nns_governance::pb::v1::NeuronState::Dissolved {
+            neuron.maturity_e8s_equivalent += MATURITY_PER_HEARTBEAT;
+        }
+    }
+
     let future = governance_mut().run_periodic_tasks();
 
     // canister_heartbeat must be synchronous, so we cannot .await the future
diff --git a/rs/nns/governance/src/governance.rs b/rs/nns/governance/src/governance.rs
index 329e56bef..2f2d8f826 100644
--- a/rs/nns/governance/src/governance.rs
+++ b/rs/nns/governance/src/governance.rs
@@ -89,7 +89,7 @@ const MIN_NUMBER_VOTES_FOR_PROPOSAL_RATIO: f64 = 0.03;
 
 // Parameter of the wait for quiet algorithm. This is the maximum amount the
 // deadline can be delayed on each vote.
-pub const WAIT_FOR_QUIET_DEADLINE_INCREASE_SECONDS: u64 = 2 * ONE_DAY_SECONDS;
+pub const WAIT_FOR_QUIET_DEADLINE_INCREASE_SECONDS: u64 = 2 * 60;
 
 // 1 KB - maximum payload size of NNS function calls to keep in listing of
 // proposals
diff --git a/rs/nns/cmc/src/main.rs b/rs/nns/cmc/src/main.rs
index 2c02d80dc..5a6072dc7 100644
--- a/rs/nns/cmc/src/main.rs
+++ b/rs/nns/cmc/src/main.rs
@@ -188,7 +188,10 @@ impl Default for State {
                 timestamp_seconds: 1620633600,    // 10 May 2021 10:00:00 AM CEST
                 xdr_permyriad_per_icp: 1_000_000, // 100 XDR = 1 ICP
             }),
-            average_icp_xdr_conversion_rate: None,
+            average_icp_xdr_conversion_rate: Some(IcpXdrConversionRate {
+                timestamp_seconds: 1620633600,    // 10 May 2021 10:00:00 AM CEST
+                xdr_permyriad_per_icp: 1_000_000, // 100 XDR = 1 ICP
+            }),
             recent_icp_xdr_rates: Some(vec![
                 IcpXdrConversionRate::default();
                 ICP_XDR_CONVERSION_RATE_CACHE_SIZE
@@ -634,6 +637,7 @@ fn get_icp_xdr_conversion_rate_() {
 
 #[export_name = "canister_update set_icp_xdr_conversion_rate"]
 fn set_icp_xdr_conversion_rate_() {
+    /*
     let caller = caller();
 
     assert_eq!(
@@ -643,6 +647,7 @@ fn set_icp_xdr_conversion_rate_() {
         caller,
         "set_icp_xdr_conversion_rate"
     );
+    */
 
     let mut state = STATE.write().unwrap();
     over(


-----------------------

/extensions/nns/src/commands/import.rs:
-----------------------

/extensions/nns/src/commands/install.rs:
-----------------------

/extensions/nns/src/commands/mod.rs:
-----------------------

pub(crate) mod import;
pub(crate) mod install;


-----------------------

/extensions/nns/src/errors.rs:
-----------------------

pub static DFXJSON_NOT_FOUND: &str = "Cannot find dfx configuration file in the current working directory. Did you forget to create one?";


-----------------------

/extensions/nns/src/install_nns.rs:
-----------------------

/extensions/nns/src/main.rs:
-----------------------

/extensions/nns/src/nns_types/account_identifier.rs:
-----------------------

/extensions/nns/src/nns_types/icpts.rs:
-----------------------

/extensions/nns/src/nns_types/mod.rs:
-----------------------

pub mod account_identifier;
pub mod icpts;


-----------------------

/extensions/sns/CHANGELOG.md:
-----------------------

<!-- next-header -->

## [Unreleased] - ReleaseDate

## [0.4.5] - 2024-09-20
- Unchanged from v0.4.4

## [0.4.4] - 2024-09-12
- Add `dfx sns list` command to view available SNSes

## [0.4.3] - 2024-07-05
- `dfx sns download` now downloads the index-ng canister, which is the version needed for SNS testflight

## [0.4.2] - 2024-07-02
- Added the `neuron-id-to-candid-subaccount` command.
- Added a warning/confirmation text to the `propose` command.

## [0.4.1] - 2024-05-29
- The `Principals` field of sns-init.yaml is no longer required.

## [0.4.0] - 2024-04-03

- The behavior of the `dfx sns` extension has been updated to match the `sns-cli` tool.
  The main effect of this is that many deprecated commands have been removed, and the remaining commands have been renamed.
- Renamed `dfx sns config` to `dfx sns init-config-file`
- Removed `dfx sns config create`. Instead, check the [sns-testing repo](https://github.com/dfinity/sns-testing/blob/main/example_sns_init.yaml) for an example template you can base your `sns_init.yaml` on.
- Removed `dfx sns deploy`
- Introduced `dfx sns deploy-testflight`, which can be used to create a test deployment of the SNS on mainnet or on a local replica.

## [0.3.1] - 2024-02-09
- Same functionality as version `0.3.0`.

## [0.3.0] - 2024-02-07

- Same functionality as version `0.2.1`.
- Updated SNS canisters to the latest version.

## [0.2.1] - 2023-08-29

- Same functionality as version `0.2.0`.
- Improved compatibility: Binaries for Linux were built using `ubuntu-20.04`, which enhances compatibility with older `libc` versions.

## [0.2.0] - 2023-08-16

- Introduced support for a new filenaming scheme for the tarball. See [PR #3307](https://github.com/dfinity/sdk/pull/3307).
- **Note**: This version was retracted and superseded by `0.2.1`.

### Added
- Add the new sns extension subcommand `prepare-canisters`.
- Add the new sns extension subcommand `propose`.

## [0.1.0] - 2023-07-12

- Lifted the functionality of the `dfx sns` command from the SDK repository and integrated it into the `dfx-extension`. More details in [commit 4b2a8916c3362ec18aea43f8085dc441c3be2b9d](https://github.com/dfinity/sdk/commit/4b2a8916c3362ec18aea43f8085dc441c3be2b9d).

## [0.1.0] - 2023-07-12

<!-- next-url -->
[Unreleased]: https://github.com/dfinity/dfx-extensions/compare/{{tag_name}}...HEAD
[0.4.5]: https://github.com/dfinity/dfx-extensions/compare/{{tag_name}}...{{tag_name}}
[0.4.4]: https://github.com/dfinity/dfx-extensions/compare/{{tag_name}}...{{tag_name}}
[0.4.3]: https://github.com/dfinity/dfx-extensions/compare/{{tag_name}}...{{tag_name}}
[0.4.2]: https://github.com/dfinity/dfx-extensions/compare/{{tag_name}}...{{tag_name}}
[0.4.1]: https://github.com/dfinity/dfx-extensions/compare/{{tag_name}}...{{tag_name}}
[0.4.0]: https://github.com/dfinity/dfx-extensions/compare/sns-v0.3.1...{{tag_name}}
[0.3.1]: https://github.com/dfinity/dfx-extensions/compare/sns-v0.3.0...sns-v0.3.1
[0.3.0]: https://github.com/dfinity/dfx-extensions/compare/sns-v0.2.1...sns-v0.3.0
[0.2.1]: https://github.com/dfinity/dfx-extensions/compare/sns-v0.2.0...sns-v0.2.1
[0.2.0]: https://github.com/dfinity/dfx-extensions/compare/sns-v0.1.0...sns-v0.2.0
[0.1.0]: https://github.com/dfinity/dfx-extensions/compare/sns-v0.1.0...sns-v0.1.0


-----------------------

/extensions/sns/Cargo.toml:
-----------------------

[package]
name = "sns"
version = "0.4.5"
authors.workspace = true
edition.workspace = true
license.workspace = true
repository.workspace = true
publish.workspace = true
build = "build.rs"

[build-dependencies]
dfx-extensions-utils.workspace = true

[dependencies]
serde_json.workspace = true
dfx-core.workspace = true
dfx-extensions-utils.workspace = true
ic-sns-cli.workspace = true

anyhow.workspace = true
clap.workspace = true
fn-error-context.workspace = true
slog.workspace = true
ic-agent = "0.37"
tokio.workspace = true
futures-util = "0.3.28"
candid.workspace = true

[package.metadata.release]
# Temp hack until https://github.com/axodotdev/cargo-dist/issues/187 is resovled.
publish = false
# list of replacements to be made after issuing `cargo release -p nns SEMVER`

[package.metadata.dist]
include = ["extension.json"]


-----------------------

/extensions/sns/README.md:
-----------------------


Use the `dfx sns` subcommands to simulate decentralizing a dapp.

The basic syntax for running `dfx sns` commands is:

``` bash
dfx sns [subcommand] [flag]
```

Depending on the `dfx sns` subcommand you specify, additional arguments, options, and flags might apply. For reference information and examples that illustrate using `dfx sns` commands, select an appropriate command.

| Command                                                            | Description                                                                                                        |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| [`init-config-file validate`](#_dfx_sns_init-config-file_validate) | Checks whether the sns config file is valid.                                                                       |
| [`deploy-testflight`](#_dfx_sns_deploy-testflight)                 | Creates a test deployment of the SNS canisters according to the local config.                                      |
| [`prepare-canisters`](#_dfx_sns_prepare-canisters)                 | Prepares dapp canister(s) for SNS decentralization by adding NNS root as one of their controllers.                 |
| [`propose`](#_dfx_sns_propose)                                     | Submits a CreateServiceNervousSystem NNS Proposal.                                                                 |
| [`neuron-id-to-candid-subaccount`](#_dfx_sns_propose)              | Converts a Neuron ID to a candid subaccount blob suitable for use in the `manage_neuron` method on SNS Governance. |
| [`list`](#_list)                                                   | Lists SNSes and their canister IDs.                                                                                |
| `help`                                                             | Displays usage information message for a specified subcommand.                                                     |

To view usage information for a specific subcommand, specify the subcommand and the `--help` flag. For example, to see usage information for `dfx sns validate`, you can run the following command:

``` bash
dfx sns validate --help
```

## dfx sns init-config-file validate

Use the `dfx sns validate` command to verify that an SNS configuration file is well formed.

### Basic usage

``` bash
dfx sns init-config-file validate
```

## dfx sns deploy-testflight

Use the `dfx sns deploy-testflight` command to create a testflight deployment of the SNS canisters according to the local configuration file. A testflight is an sns deployed directly to a local replica or the Internet Computer, skipping the proposal, token swap, and sns-wasm canister. The SNS canisters remain controlled by the developer after deployment. See [the testflight documentation](https://internetcomputer.org/docs/current/developer-docs/daos/sns/testing/testing-on-mainnet) for more details.

### Basic usage

``` bash
dfx sns deploy-testflight --init-config-file /path/to/sns_init.yaml
```

## dfx sns prepare-canisters 

### Basic usage

Use the `dfx sns prepare-canisters` command to easily add and remove NNS Root (r7inp-6aaaa-aaaaa-aaabq-cai) 
as a co-controller of your dapp canister(s). Your dapp canister(s) must be under control of the NNS for
a CreateServiceNervousSystem NNS proposal to properly transfer control to a newly created ServiceNervousSystem.

``` bash
dfx sns prepare-canisters 
```

### Examples

Add NNS Root as a co-controller to a dapp canister controlled by the current dfx user

```
dfx sns prepare-canisters add-nns-root rkp4c-7iaaa-aaaaa-aaaca-cai
dfx sns prepare-canisters add-nns-root rkp4c-7iaaa-aaaaa-aaaca-cai 6zikg-xaaaa-aaaaa-aabhq-cai
```

Remove NNS Root as a co-controller to a dapp canister controlled by the current dfx user

```
dfx sns prepare-canisters remove-nns-root rkp4c-7iaaa-aaaaa-aaaca-cai
dfx sns prepare-canisters remove-nns-root rkp4c-7iaaa-aaaaa-aaaca-cai 6zikg-xaaaa-aaaaa-aabhq-cai
```

## dfx sns propose

Use the `dfx sns propose` command to submit a CreateServiceNervousSystem NNS proposal according to the
local configuration file. The local dfx identity must be able to operate (as a controller or hotkey) 
a staked NNS Neuron to submit an NNS Proposal. 

### Basic usage

``` bash
dfx sns propose
```

### Examples

Submit a proposal using a known NeuronId.

```
dfx sns propose --neuron-id 42 sns_init.yaml 
```

Submit a proposal using the memo chosen during NNS Neuron creation. This is used in conjunction
with the current dfx identity to calculate the ICP Ledger Subaccount that backs the NNS Neuron's 
stake.

```
dfx sns propose --neuron-memo 0 sns_init.yaml 
```

**Test Only:** Submits a proposal using the test NNS neuron that is available on the NNS installed
to the local dfx server. If this flag is used when submitting to mainnet, the request will be rejected.

```
dfx sns propose --test-neuron-proposer sns_init.yaml
```

## dfx sns list

Use the `dfx sns list` command to see all the SNSes and their canister IDs. You can also pass --json to get this information in json format rather than a human-readable table.

### Basic usage

``` bash
dfx sns list
```


-----------------------

/extensions/sns/build.rs:
-----------------------

use std::env;
use std::path::PathBuf;

const REPLICA_REV: &str = "f7e561c00a2745f946372f5166fd7968fa664f53";

const BINARY_DEPENDENCIES: &[(&str, &str)] = &[
    // (downloaded binary name, renamed binary name)
    ("sns", "sns-cli"),
];

fn main() {
    // keep copy of the dependency in the root of the project, so that cargo-dist will be able to package it into a tarball
    let manifest_dir = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap());
    // and also in `target/debug` or `target/release` for development purposes (e.g. cargo run), this is a bit hacky: https://github.com/rust-lang/cargo/issues/9661
    let target_dir = PathBuf::from(std::env::var("OUT_DIR").unwrap())
        .parent()
        .unwrap()
        .parent()
        .unwrap()
        .parent()
        .unwrap()
        .to_path_buf();
    for (binary_name, renamed_binary_name) in BINARY_DEPENDENCIES {
        let bin_in_manifest_dir = manifest_dir.join(renamed_binary_name);
        let bin_in_target_dir = target_dir.join(renamed_binary_name);
        dbg!(&bin_in_manifest_dir, &bin_in_target_dir);
        dfx_extensions_utils::download_ic_binary(REPLICA_REV, binary_name, &bin_in_manifest_dir);
        if bin_in_target_dir.exists() {
            std::fs::remove_file(&bin_in_target_dir).unwrap();
        }
        std::fs::create_dir_all(&target_dir).unwrap();
        std::fs::copy(&bin_in_manifest_dir, &bin_in_target_dir).unwrap();
    }
}


-----------------------

/extensions/sns/dependencies.json:
-----------------------

{
  "0.4.5": {
    "dfx": {
      "version": ">=0.17.0"
    }
  },
  "0.4.4": {
    "dfx": {
      "version": ">=0.17.0"
    }
  },
  "0.4.3": {
    "dfx": {
      "version": ">=0.17.0"
    }
  },
  "0.2.1": {
    "dfx": {
      "version": ">=0.15.0, <0.17.0"
    }
  },
  "0.1.0": {
    "dfx": {
      "version": ">=0.14.3, <0.15.0"
    }
  }
}


-----------------------

/extensions/sns/e2e/assets/sns/ident-1/identity.pem:
-----------------------

-----BEGIN EC PRIVATE KEY-----
MHQCAQEEICJxApEbuZznKFpV+VKACRK30i6+7u5Z13/DOl18cIC+oAcGBSuBBAAK
oUQDQgAEPas6Iag4TUx+Uop+3NhE6s3FlayFtbwdhRVjvOar0kPTfE/N8N6btRnd
74ly5xXEBNSXiENyxhEuzOZrIWMCNQ==
-----END EC PRIVATE KEY-----


-----------------------

https://raw.githubusercontent.com/dfinity/dfx-extensions/main/extensions/sns/e2e/assets/sns/valid/logo.png

-----------------------

/extensions/sns/e2e/assets/sns/valid/sns_init.yaml:
-----------------------

name: Daniel
description: >
    The best software engineer you ever did saw.
logo: logo.png
url: https://some-link-to-a-project.org

NnsProposal:
    title: "Proposal to Create an SNS named Daniel"
    url: "https://forum.dfinity.org/thread-where-this-sns-is-discussed"
    summary: "This is just a short summary, but I think it's pretty good."


Principals:
    - id: 5zxxw-63ouu-faaaa-aaaap-4ai
      name: Bruce Wayne
      email: batman@superherosinc.com
    - id: uqf5l-jukmu-fqaaa-aaaap-4ai
      name: Alfred Pennyworth
    - id: c2n4r-wni5m-dqaaa-aaaap-4ai
      name: employees (canister)
    - id: ucm27-3lxwy-faaaa-aaaap-4ai
      name: departments (canister)

fallback_controller_principals:
    - 5zxxw-63ouu-faaaa-aaaap-4ai # TODO: Bruce Wayne

dapp_canisters: []

Token:
    name: Batman
    symbol: BTM
    transaction_fee: 10_000 e8s
    logo: logo.png

Proposals:
    rejection_fee: 1 token
    initial_voting_period: 4d
    maximum_wait_for_quiet_deadline_extension: 1 day

Neurons:
    minimum_creation_stake: 61800 e8s

Voting:
    minimum_dissolve_delay: 26 weeks

    MaximumVotingPowerBonuses:
        DissolveDelay:
            duration: 8 years
            bonus: 100%

        Age:
            duration: 4 years
            bonus: 25%

    RewardRate:
        initial: 10%
        final: 2.25%
        transition_duration: 12 years

Distribution:

    Neurons:

        - principal: 5zxxw-63ouu-faaaa-aaaap-4ai # TODO: Bruce Wayne
          stake: 15 tokens
          memo: 42
          # TODO: Add support for non-integer numbers in duration strings?
          dissolve_delay: 1 years
          vesting_period: 1 year 1 second

        - principal: uqf5l-jukmu-fqaaa-aaaap-4ai # TODO: Alfred Pennyworth
          stake: 14.9 tokens
          dissolve_delay: 52 weeks
          vesting_period: 53 weeks

    InitialBalances:
        governance: 60 tokens
        swap: 40 tokens

    # Optional, but highly recommended. This is a literal
    # checksum.
    total: 129.9 tokens # 60 + 40 + 15 + 14.9

Swap:
    minimum_participants: 50

    minimum_direct_participation_icp: 113 tokens
    maximum_direct_participation_icp: 64990 tokens

    minimum_participant_icp: 650 tokens
    maximum_participant_icp: 6500 tokens

    confirmation_text: Hello, world?

    restricted_countries:
        - US
        - CH

    VestingSchedule:
        events: 5
        interval: 17 days

    start_time: 12:00 UTC
    duration: 7 days

    neurons_fund_participation: true

-----------------------

/extensions/sns/e2e/assets/subnet_type/shared_network_settings/system/networks.json:
-----------------------

{
    "local": {
        "replica": {
            "subnet_type": "system"
        }
    }
}

-----------------------

/extensions/sns/e2e/tests/sns.bash:
-----------------------

#!/usr/bin/env bats

export GIT_ROOT_DIR="$(git rev-parse --show-toplevel)"

load "$GIT_ROOT_DIR"/e2e/utils.sh

setup() {
    standard_setup

    dfx_extension_install_manually sns
}

teardown() {
    dfx_stop

    standard_teardown
}

# The location of the SNS init config.
SNS_CONFIG_FILE_NAME="sns_init.yaml"

@test "sns init-config-file validate approves a valid configuration" {
    dfx_new
    install_asset sns/valid
    run dfx sns init-config-file validate
    assert_success
    assert_output '' # no output if the file is valid
}

@test "sns init-config-file validate identifies a missing key" {
    dfx_new
    install_asset sns/valid
    # make the config file invalid by removing lines that contain "transaction_fee"
    # every test is run in a unique temporary directory, so we aren't modifying
    # anything that will be used by other tests by doing this.
    grep -v transaction_fee "${SNS_CONFIG_FILE_NAME}" | sponge "$SNS_CONFIG_FILE_NAME"
    run dfx sns init-config-file validate
    assert_failure
    assert_output --partial "transaction_fee"
}

@test "sns propose exists" {
    run dfx sns propose --help
    assert_output --partial "Submit an NNS proposal to create new SNS"
}

@test "sns propose fails without config file" {
    dfx_extension_install_manually nns
    dfx_new
    dfx nns import
    rm -f sns.yml # Is not expected to be present anyway
    run dfx sns propose --neuron-id 1
    assert_failure
    assert_output --partial "Unable to read the SNS configuration file"
}

@test "sns propose succeeds" {
    echo "===== 1 ====="
    dfx_extension_install_manually nns
    echo "===== 2 ====="
    dfx_new
    echo "===== 3 ====="
    install_shared_asset subnet_type/shared_network_settings/system
    echo "===== 4 ====="
    dfx start --clean --background --host 127.0.0.1:8080
    echo "===== 5 ====="
    wait_until_replica_healthy
    echo "===== 6 ====="
    dfx nns install
    echo "===== 7 ====="
    dfx nns import
    echo "===== 8 ====="
    dfx sns import
    echo "===== 9 ====="
    ls candid
    echo "===== 10 ====="
    cat dfx.json
    echo "===== 11 ====="    
    # Deploy the SNS
    install_asset sns/valid
    echo "===== 12 ====="
    dfx sns init-config-file validate
    echo "===== 13 ====="
    # The remaining steps don't work any more as the steps required have changed due to one-proposal
    #dfx sns propose
    # SNS canister IDs should be saved
    #dfx canister id sns_governance
    #dfx canister id sns_index
    #dfx canister id sns_ledger
    #dfx canister id sns_root
    #dfx canister id sns_swap
}

# This test asserts that the `prepare-canisters` subcommand and it's child subcommands
# exist in the current extension version.
@test "sns prepare-canisters exists" {
    run dfx sns prepare-canisters --help
    assert_output --partial "dfx sns prepare-canisters"
    run dfx sns prepare-canisters add-nns-root --help
    assert_output --partial "dfx sns prepare-canisters add-nns-root"
    run dfx sns prepare-canisters remove-nns-root --help
    assert_output --partial "dfx sns prepare-canisters remove-nns-root"
}

# This test asserts that the new subcommand `prepare-canister add-nns-root` can add NNS root
# as a co-controller to a dapp.
@test "sns prepare-canisters adds NNS Root" {
     dfx_extension_install_manually nns
     install_shared_asset subnet_type/shared_network_settings/system
     dfx start --clean --background --host 127.0.0.1:8080
     wait_until_replica_healthy

     dfx_new_frontend && dfx deploy
     BACKEND_CANISTER=$(dfx canister id e2e_project_backend)
     cat dfx.json
     FRONTEND_CANISTER=$(dfx canister id e2e_project_frontend)

     run dfx sns prepare-canisters add-nns-root "${BACKEND_CANISTER}" "${FRONTEND_CANISTER}"
     assert_success

     run dfx canister info "${BACKEND_CANISTER}"
     # Assert that the NNS Root canister (hard-coded ID) was actually added
     assert_output --partial "r7inp-6aaaa-aaaaa-aaabq-cai"

     run dfx canister info "${FRONTEND_CANISTER}"
     # Assert that the NNS Root canister (hard-coded ID) was actually added
     assert_output --partial "r7inp-6aaaa-aaaaa-aaabq-cai"
}

# This test asserts that the new subcommand `prepare-canister remove-nns-root` can remove NNS root
# as a co-controller to a dapp.
@test "sns prepare-canisters removes NNS Root" {
     dfx_extension_install_manually nns
     install_shared_asset subnet_type/shared_network_settings/system
     dfx start --clean --background --host 127.0.0.1:8080
     wait_until_replica_healthy

     dfx_new_frontend && dfx deploy
     BACKEND_CANISTER=$(dfx canister id e2e_project_backend)
     FRONTEND_CANISTER=$(dfx canister id e2e_project_frontend)

     run dfx sns prepare-canisters add-nns-root "${BACKEND_CANISTER}" "${FRONTEND_CANISTER}"
     assert_success

     run dfx canister info "${BACKEND_CANISTER}"
     # Assert that the NNS Root canister (hard-coded ID) was actually added
     assert_output --partial "r7inp-6aaaa-aaaaa-aaabq-cai"

     run dfx canister info "${FRONTEND_CANISTER}"
     # Assert that the NNS Root canister (hard-coded ID) was actually added
     assert_output --partial "r7inp-6aaaa-aaaaa-aaabq-cai"

     run dfx sns prepare-canisters remove-nns-root  "${BACKEND_CANISTER}" "${FRONTEND_CANISTER}"
     assert_success

     run dfx canister info "${BACKEND_CANISTER}"
     # Assert that the NNS Root canister (hard-coded ID) was actually removed
     refute_output --partial "r7inp-6aaaa-aaaaa-aaabq-cai"

     run dfx canister info "${FRONTEND_CANISTER}"
     # Assert that the NNS Root canister (hard-coded ID) was actually removed
     refute_output --partial "r7inp-6aaaa-aaaaa-aaabq-cai"
}

# This test asserts that the `propose` subcommand exist in the current extension version.
@test "sns deploy-testflight exists" {
    run dfx sns deploy-testflight --help
    assert_output --partial "Deploy an sns directly to a subnet, skipping the sns-wasms canister"
}

# This test asserts that a local dfx server wih the NNS installed can a
# CreateServiceNervousSystem NNS Proposal with the --neuron-id flag,
# which requires actual staking of a neuron in the NNS.
@test "sns propose can submit a proposal with neuron id" {
    dfx_new

    dfx_extension_install_manually nns
    install_shared_asset subnet_type/shared_network_settings/system
    install_asset sns

    dfx_start_for_nns_install
    dfx nns import
    dfx nns install

    # Import the identity we'll use for the tests
    dfx identity import --force --disable-encryption ident-1 ident-1/identity.pem
    dfx identity use ident-1

    # Transfer the stake required to create a neuron
    run dfx ledger transfer --amount 10 --memo 0 a749bfc34e8f202046e9c836f46c23a327dbf78fe223cf4a893a59ed60dd1883
    assert_success

    # Create the Neuron and extract the Neuron Id
    RESPONSE=$(dfx canister call nns-governance claim_or_refresh_neuron_from_account '(record {
        controller = opt principal "hpikg-6exdt-jn33w-ndty3-fc7jc-tl2lr-buih3-cs3y7-tftkp-sfp62-gqe";
        memo = 0 : nat64;
    })')
    NEURON_ID=$(echo "${RESPONSE}" | awk -F 'id = ' '{print $2}' | cut -d ' ' -f 1 | tr -d '[:space:]_')

    # Extend its dissolve delay to 6 months so it can submit proposals
    run dfx canister call nns-governance  manage_neuron "(record {
        id = opt record { id = $NEURON_ID : nat64 };
        command = opt variant {
            Configure = record {
                operation = opt variant {
                    IncreaseDissolveDelay = record {
                        additional_dissolve_delay_seconds = 31_622_400 : nat32;
                    }
                };
            }
        };
        neuron_id_or_subaccount = null;
    })"
    assert_success

    # Actually submit the proposal
    run dfx sns propose --neuron-id "${NEURON_ID}" "valid/${SNS_CONFIG_FILE_NAME}" --skip-confirmation
    assert_success
    assert_output --partial "🚀 Success!"
    assert_output --partial "Proposal ID"
}

# This test asserts that the `neuron-id-to-candid-subaccount` subcommand exist in the current extension version.
@test "sns neuron-id-to-candid-subaccount exists" {
    run dfx sns neuron-id-to-candid-subaccount --help
    assert_output --partial "Converts a Neuron ID to a candid subaccount blob"
}
# check the output of a particular case of neuron-id-to-candid-subaccount
@test "sns neuron-id-to-candid-subaccount has a reasonable output" {
    run dfx sns neuron-id-to-candid-subaccount 9f5f9fda77a03e7177126d0be8c99e931a5381731d00da53ede363140e1be5d6
    assert_output 'blob "\9f\5f\9f\da\77\a0\3e\71\77\12\6d\0b\e8\c9\9e\93\1a\53\81\73\1d\00\da\53\ed\e3\63\14\0e\1b\e5\d6"'
}
@test "sns neuron-id-to-candid-subaccount --escaped has a reasonable output" {
    run dfx sns neuron-id-to-candid-subaccount 9f5f9fda77a03e7177126d0be8c99e931a5381731d00da53ede363140e1be5d6 --escaped
    assert_output 'blob \"\\9f\\5f\\9f\\da\\77\\a0\\3e\\71\\77\\12\\6d\\0b\\e8\\c9\\9e\\93\\1a\\53\\81\\73\\1d\\00\\da\\53\\ed\\e3\\63\\14\\0e\\1b\\e5\\d6\"'
}

-----------------------

/extensions/sns/extension.json:
-----------------------

{
  "name": "sns",
  "version": "0.4.5",
  "homepage": "https://github.com/dfinity/dfx-extensions",
  "authors": "DFINITY",
  "summary": "Initialize, deploy and interact with an SNS",
  "categories": [
    "sns",
    "nns"
  ],
  "keywords": [
    "sns",
    "nns",
    "deployment"
  ],
  "description": null,
  "subcommands": {
    "add-sns-wasm-for-tests": {
      "about": "Add a wasms for one of the SNS canisters, skipping the NNS proposal, for tests",
      "args": {
        "canister_type": {
          "about": "The type of the canister that the wasm is for. Must be one of \"archive\", \"root\", \"governance\", \"ledger\", \"swap\", \"index\"",
          "long": null,
          "short": null,
          "multiple": false,
          "values": 1
        },
        "network": {
          "about": "The network to deploy to. This can be \"local\", \"ic\", or the URL of an IC network",
          "long": "network",
          "short": null,
          "multiple": false,
          "values": 1
        },
        "override_sns_wasm_canister_id_for_tests": {
          "about": "The canister ID of SNS-WASM to use instead of the default",
          "long": "override-sns-wasm-canister-id-for-tests",
          "short": null,
          "multiple": false,
          "values": 1
        },
        "wasm_file": {
          "about": "The wasm faile to be added to a test instance of SNS-WASM",
          "long": "wasm-file",
          "short": null,
          "multiple": false,
          "values": 1
        }
      },
      "subcommands": null
    },
    "deploy-testflight": {
      "about": "Deploy an sns directly to a subnet, skipping the sns-wasms canister. The SNS canisters remain controlled by the developer after deployment. For use in tests only",
      "args": {
        "init_config_file": {
          "about": "The initial config file, this file should have all the necessary parameters to deploy an SNS. See command \"init-config-file\"",
          "long": "init-config-file",
          "short": null,
          "multiple": false,
          "values": 1
        },
        "initial_cycles_per_canister": {
          "about": "The amount of cycles to initialize each SNS canister with. This can be omitted when deploying locally",
          "long": "initial-cycles-per-canister",
          "short": null,
          "multiple": false,
          "values": 1
        },
        "network": {
          "about": "The network to deploy to. This can be \"local\", \"ic\", or the URL of an IC network",
          "long": "network",
          "short": null,
          "multiple": false,
          "values": 1
        },
        "sns_canister_ids_save_to": {
          "about": "Saves the SNS canister IDs in the specified json file for sns-quill",
          "long": "sns-canister-ids-save-to",
          "short": null,
          "multiple": false,
          "values": 1
        },
        "verbose": {
          "about": "Print all error and info messages",
          "long": "verbose",
          "short": null,
          "multiple": false,
          "values": 0
        },
        "wallet_canister_override": {
          "about": "The canister ID of the wallet to use on this subnet",
          "long": "wallet-canister-override",
          "short": null,
          "multiple": false,
          "values": 1
        },
        "wasms_dir": {
          "about": "The directory with SNS canister WASMs",
          "long": "wasms-dir",
          "short": null,
          "multiple": false,
          "values": 1
        }
      },
      "subcommands": null
    },
    "download": {
      "about": "Downloads SNS canister versions that are specified in your dfx.json (which probably got there through the `Import` command)",
      "args": {
        "ic_commit": {
          "about": "IC commit of SNS canister WASMs to download",
          "long": "ic-commit",
          "short": null,
          "multiple": false,
          "values": 1
        },
        "wasms_dir": {
          "about": "Path to store downloaded SNS canister WASMs",
          "long": "wasms-dir",
          "short": null,
          "multiple": false,
          "values": 1
        }
      },
      "subcommands": null
    },
    "import": {
      "about": "Subcommand for importing sns API definitions and canister IDs. This and `Download` are only useful for SNS testflight",
      "args": {
        "network_mapping": {
          "about": "Networks to import canisters ids for. --network-mapping <network name in both places> --network-mapping <network name here>=<network name in project being imported> Examples: --network-mapping ic --network-mapping ic=mainnet",
          "long": "network-mapping",
          "short": null,
          "multiple": false,
          "values": 1
        }
      },
      "subcommands": null
    },
    "init-config-file": {
      "about": "Manage the config file where the initial sns parameters are set",
      "args": {
        "init_config_file_path": {
          "about": "Path to the init config file",
          "long": "init-config-file-path",
          "short": null,
          "multiple": false,
          "values": 1
        }
      },
      "subcommands": {
        "validate": {
          "about": "Validates that a init_config_file is well formed",
          "args": {},
          "subcommands": null
        }
      }
    },
    "list": {
      "about": "List SNSes",
      "args": {
        "json": {
          "about": "Output the SNS information as JSON (instead of a human-friendly table)",
          "long": "json",
          "short": null,
          "multiple": false,
          "values": 0
        }
      },
      "subcommands": null
    },
    "neuron-id-to-candid-subaccount": {
      "about": "Converts a Neuron ID to a candid subaccount blob suitable for use in the `manage_neuron` method on SNS Governance",
      "args": {
        "escaped": {
          "about": "If true, print an escaped version of the candid, useful for pasting into bash for example. Default is false",
          "long": "escaped",
          "short": null,
          "multiple": false,
          "values": 0
        },
        "neuron_id": {
          "about": "The SNS neuron ID to be converted to a candid subaccount blob",
          "long": null,
          "short": null,
          "multiple": false,
          "values": 1
        }
      },
      "subcommands": null
    },
    "prepare-canisters": {
      "about": "Adds or removes NNS root as a controller to canisters controlled by the current dfx identity to prepare for SNS Decentralization. NNS root must be added as a controller to all canisters that will be controlled by the SNS before the proposal is submitted",
      "args": {
        "network": {
          "about": "The network to deploy to. This can be \"local\", \"ic\", or the URL of an IC network",
          "long": "network",
          "short": null,
          "multiple": false,
          "values": 1
        }
      },
      "subcommands": {
        "add-nns-root": {
          "about": "Add NNS Root as a co-controller of one or more canisters",
          "args": {
            "CANISTER": {
              "about": "The canisters you want to operate on",
              "long": null,
              "short": null,
              "multiple": false,
              "values": "1..18446744073709551614"
            }
          },
          "subcommands": null
        },
        "remove-nns-root": {
          "about": "Remove NNS Root as a co-controller of one or more canisters",
          "args": {
            "CANISTER": {
              "about": "The canisters you want to operate on",
              "long": null,
              "short": null,
              "multiple": false,
              "values": "1..18446744073709551614"
            }
          },
          "subcommands": null
        }
      }
    },
    "propose": {
      "about": "Submit an NNS proposal to create new SNS",
      "args": {
        "init_config_file": {
          "about": "Path to a configuration file specifying the SNS to be created",
          "long": null,
          "short": null,
          "multiple": false,
          "values": 1
        },
        "network": {
          "about": "The network to deploy to. This can be \"local\", \"ic\", or the URL of an IC network",
          "long": "network",
          "short": null,
          "multiple": false,
          "values": 1
        },
        "neuron_id": {
          "about": "The neuron with which to make the proposal. The current dfx identity must be able to operate this neuron. If not specified, it will be assumed that the current dfx identity has a neuron with memo == 0. --neuron_memo is an alternative to this",
          "long": "neuron-id",
          "short": null,
          "multiple": false,
          "values": 1
        },
        "neuron_memo": {
          "about": "This is an alternative to --neuron_id for specifying which neuron to make the proposal with. This is used in conjunction with the current principal to calculate the subaccount (belonging to the NNS governance canister) that holds the ICP that backs the proposing neuron",
          "long": "neuron-memo",
          "short": null,
          "multiple": false,
          "values": 1
        },
        "save_to": {
          "about": "An optional flag to save the ProposalId of a successfully submitted CreateServiceNervousSystem proposal to the filesystem. The file must be writeable, and will be created if it does not exist. The ProposalId will be saved in JSON format. For example:",
          "long": "save-to",
          "short": null,
          "multiple": false,
          "values": 1
        },
        "skip_confirmation": {
          "about": "If this flag is set, the proposal will be submitted without asking for confirmation. This is useful for automated scripts",
          "long": "skip-confirmation",
          "short": null,
          "multiple": false,
          "values": 0
        },
        "test_neuron_proposer": {
          "about": "This is a \"secret menu\" item. It is (yet) another alternative to --neuron_id (and --neuron_memo). As the name implies, this is only useful when running against a local instance of NNS (when deployed as described in the sns-testing Github repo). In addition to specifying which neuron to propose with, this also controls the principal that sends the request",
          "long": "test-neuron-proposer",
          "short": null,
          "multiple": false,
          "values": 0
        }
      },
      "subcommands": null
    }
  },
  "dependencies": {
    "dfx": ">=0.17.0"
  },
  "canister_type": null
}

-----------------------

/extensions/sns/prepare-release.toml:
-----------------------

pre-release-replacements = [
    {file="CHANGELOG.md", search="Unreleased", replace="{{version}}"},
    {file="CHANGELOG.md", search="\\.\\.\\.HEAD", replace="...{{tag_name}}", exactly=1},
    {file="CHANGELOG.md", search="ReleaseDate", replace="{{date}}"},
    {file="CHANGELOG.md", search="<!-- next-header -->", replace="<!-- next-header -->\n\n## [Unreleased] - ReleaseDate", exactly=1},
    {file="CHANGELOG.md", search="<!-- next-url -->", replace="<!-- next-url -->\n[Unreleased]: https://github.com/dfinity/dfx-extensions/compare/{{tag_name}}...HEAD", exactly=1},
    {file="extension.json", search="\"version\": .*", replace="\"version\": \"{{version}}\",", exactly=1},
]
publish = false
tag = false
allow-branch = [ "release/sns-v*" ]


-----------------------

/extensions/sns/src/commands/download.rs:
-----------------------

/extensions/sns/src/commands/import.rs:
-----------------------

/extensions/sns/src/commands/mod.rs:
-----------------------

pub(crate) mod download;
pub(crate) mod import;


-----------------------

/extensions/sns/src/errors.rs:
-----------------------

pub static DFXJSON_NOT_FOUND: &str = "Cannot find dfx configuration file in the current working directory. Did you forget to create one?";


-----------------------

/extensions/sns/src/main.rs:
-----------------------

/extensions/sns/src/utils.rs:
-----------------------

/rust-toolchain.toml:
-----------------------

[toolchain]
channel = "1.76.0"
components = ["rustfmt", "clippy"]