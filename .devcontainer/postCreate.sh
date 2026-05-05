#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

MANAGED_BASHRC="/usr/local/share/devcontainer/bashrc"
USER_BASHRC="${HOME}/.bashrc"
USER_BASHRC_LEGACY="${HOME}/.bashrc_legacy"

archive_existing_bashrc() {
	local archive_path="${USER_BASHRC_LEGACY}"
	if [[ -e ${archive_path} ]] || [[ -L ${archive_path} ]]; then
		archive_path="${USER_BASHRC_LEGACY}.$(date +%Y%m%d%H%M%S)"
	fi

	mv "${USER_BASHRC}" "${archive_path}"
}

is_managed_symlink() {
	local resolved_target

	if [[ ! -L ${USER_BASHRC} ]]; then
		return 1
	fi

	if resolved_target="$(readlink -f "${USER_BASHRC}")"; then
		[[ ${resolved_target} == "${MANAGED_BASHRC}" ]]
	else
		return 1
	fi
}

if [[ ! -r ${MANAGED_BASHRC} ]]; then
	echo "Managed bashrc not found: ${MANAGED_BASHRC}" >&2
	exit 1
fi

# Archive any existing ~/.bashrc that is not the exact managed symlink.
if [[ -e ${USER_BASHRC} ]] || [[ -L ${USER_BASHRC} ]]; then
	# Keep the symlink check inside the conditional so a non-match does not
	# abort the script under `set -e`.
	# trunk-ignore(shellcheck/SC2310)
	if ! is_managed_symlink; then
		archive_existing_bashrc
	fi
fi

ln -sfn "${MANAGED_BASHRC}" "${USER_BASHRC}"

if [[ -f "${REPO_DIR}/package.json" ]]; then
	cd "${REPO_DIR}"
	node common/scripts/install-run-rush.js install --max-install-attempts 1
fi
