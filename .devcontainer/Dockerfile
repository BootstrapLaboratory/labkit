FROM mcr.microsoft.com/devcontainers/javascript-node:24

SHELL ["/bin/bash", "-o", "pipefail", "-c"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD bash -lc 'true'

ARG DAGGER_VERSION=0.20.6

# trunk-ignore(hadolint/DL3008)
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      bash-completion \
      ca-certificates \
      curl \
      git \
      gpg \
 && install -d -m 0755 /etc/apt/keyrings \
 && curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
      -o /etc/apt/keyrings/githubcli-archive-keyring.gpg \
 && chmod 0644 /etc/apt/keyrings/githubcli-archive-keyring.gpg \
 && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
      > /etc/apt/sources.list.d/github-cli.list \
 && curl -fsSL https://download.docker.com/linux/debian/gpg \
      -o /etc/apt/keyrings/docker.asc \
 && chmod 0644 /etc/apt/keyrings/docker.asc \
 && . /etc/os-release \
 && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian ${VERSION_CODENAME} stable" \
      > /etc/apt/sources.list.d/docker.list \
 && apt-get update \
 && apt-get install -y --no-install-recommends \
      docker-ce-cli \
      gh \
 && DPKG_ARCH="$(dpkg --print-architecture)" \
 && case "${DPKG_ARCH}" in \
      amd64) DAGGER_ARCH="amd64" ;; \
      arm64) DAGGER_ARCH="arm64" ;; \
      *) echo "Unsupported Dagger architecture: ${DPKG_ARCH}" >&2; exit 1 ;; \
    esac \
 && DAGGER_ARCHIVE="dagger_v${DAGGER_VERSION}_linux_${DAGGER_ARCH}.tar.gz" \
 && DAGGER_URL="https://dl.dagger.io/dagger/releases/${DAGGER_VERSION}/${DAGGER_ARCHIVE}" \
 && curl -fsSL "${DAGGER_URL}" -o "/tmp/${DAGGER_ARCHIVE}" \
 && tar -xzf "/tmp/${DAGGER_ARCHIVE}" -C /usr/local/bin dagger \
 && chmod 0755 /usr/local/bin/dagger \
 && rm -f "/tmp/${DAGGER_ARCHIVE}" \
 && rm -rf /var/lib/apt/lists/*

COPY bashrc_additions.sh /tmp/bashrc_additions.sh
RUN install -d -m 0755 /usr/local/share/devcontainer \
 && cat /etc/skel/.bashrc /tmp/bashrc_additions.sh > /usr/local/share/devcontainer/bashrc \
 && chown root:root /usr/local/share/devcontainer/bashrc \
 && chmod 0644 /usr/local/share/devcontainer/bashrc \
 && rm -f /tmp/bashrc_additions.sh

WORKDIR /workspace
# trunk-ignore(hadolint/DL3002)
# trunk-ignore(checkov/CKV_DOCKER_8)
USER root
