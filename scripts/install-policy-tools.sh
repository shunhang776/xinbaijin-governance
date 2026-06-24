#!/usr/bin/env bash
set -euo pipefail

OS="$(uname -s)"
if [[ "${OS}" != "Linux" ]]; then
  echo "LOCAL_NOT_EXECUTED: OPA/Conftest Linux binaries cannot be installed on ${OS}."
  echo "Policy tools are downloaded and executed on ubuntu-latest CI only."
  exit 0
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BIN_DIR="${ROOT}/.tools/bin"
CACHE_DIR="${ROOT}/.tools/cache"
mkdir -p "${BIN_DIR}" "${CACHE_DIR}"

OPA_VERSION="$(cd "${ROOT}" && node -p "require('./versions.json').opa")"
CONFTEST_VERSION="$(cd "${ROOT}" && node -p "require('./versions.json').conftest")"
ARCH="$(uname -m)"
case "${ARCH}" in
  x86_64) OPA_ARCH="amd64"; CONFTEST_ARCH="x86_64" ;;
  aarch64|arm64) OPA_ARCH="arm64"; CONFTEST_ARCH="arm64" ;;
  *) echo "Unsupported architecture: ${ARCH}" >&2; exit 1 ;;
esac

verify_sha256() {
  local file="$1"
  local expected="$2"
  local actual
  actual="$(sha256sum "${file}" | awk '{print $1}')"
  if [[ -z "${expected}" || "${actual}" != "${expected}" ]]; then
    echo "SHA-256 verification failed for ${file}" >&2
    echo "expected=${expected}" >&2
    echo "actual=${actual}" >&2
    exit 1
  fi
}

if [[ ! -x "${BIN_DIR}/opa" ]]; then
  opa_asset="opa_linux_${OPA_ARCH}_static"
  opa_file="${CACHE_DIR}/${opa_asset}-${OPA_VERSION}"
  opa_checksum="${CACHE_DIR}/${opa_asset}-${OPA_VERSION}.sha256"
  curl --fail --location --retry 3 \
    "https://github.com/open-policy-agent/opa/releases/download/v${OPA_VERSION}/${opa_asset}" \
    --output "${opa_file}"
  curl --fail --location --retry 3 \
    "https://github.com/open-policy-agent/opa/releases/download/v${OPA_VERSION}/${opa_asset}.sha256" \
    --output "${opa_checksum}"
  verify_sha256 "${opa_file}" "$(awk '{print $1}' "${opa_checksum}")"
  install -m 0755 "${opa_file}" "${BIN_DIR}/opa"
fi

if [[ ! -x "${BIN_DIR}/conftest" ]]; then
  conftest_asset="conftest_${CONFTEST_VERSION}_Linux_${CONFTEST_ARCH}.tar.gz"
  conftest_archive="${CACHE_DIR}/${conftest_asset}"
  conftest_checksums="${CACHE_DIR}/conftest-${CONFTEST_VERSION}-checksums.txt"
  curl --fail --location --retry 3 \
    "https://github.com/open-policy-agent/conftest/releases/download/v${CONFTEST_VERSION}/${conftest_asset}" \
    --output "${conftest_archive}"
  curl --fail --location --retry 3 \
    "https://github.com/open-policy-agent/conftest/releases/download/v${CONFTEST_VERSION}/checksums.txt" \
    --output "${conftest_checksums}"
  conftest_expected="$(awk -v asset="${conftest_asset}" '$2 == asset {print $1}' "${conftest_checksums}")"
  verify_sha256 "${conftest_archive}" "${conftest_expected}"
  tar -xzf "${conftest_archive}" -C "${BIN_DIR}" conftest
  chmod +x "${BIN_DIR}/conftest"
fi

"${BIN_DIR}/opa" version
"${BIN_DIR}/conftest" --version
