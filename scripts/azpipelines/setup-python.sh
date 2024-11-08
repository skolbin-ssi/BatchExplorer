#!/bin/bash

set -e

pyroot="$AGENT_WORKFOLDER/.venv/batchexplorer"

if [ "$AGENT_OS" == "Windows_NT" ]; then
    # Python is already installed via a pipeline task
    conf_file="$pyroot/pip.ini"
else
    conf_file="$pyroot/pip.conf"
    pyenv_version=2.3.2
    python_version=3.9.4

    echo "Installing pyenv..."
    export PYENV_ROOT="$AGENT_WORKFOLDER/.pyenv"
    archive="$PYENV_ROOT/pyenv.tar.gz"
    mkdir -p "$PYENV_ROOT"
    curl -s -S -L "https://github.com/pyenv/pyenv/archive/v${pyenv_version}.tar.gz" > "$archive"
    echo "f4347e6740e6cd47badc302491b105615a74fbf2  $archive" | shasum -c
    tar xzf "$archive" -C "$PYENV_ROOT" --strip-components=1
    export PATH="$PYENV_ROOT/bin:$PATH"
    pyenv --version

    echo "Installing Python $python_version..."
    env PYTHON_CONFIGURE_OPTS="--enable-shared" pyenv install $python_version
    pyenv global "$python_version"
    eval "$(pyenv init -)"
    echo "##vso[task.prependpath]$PYENV_ROOT/bin"
    echo "##vso[task.prependpath]$PYENV_ROOT/shims"
fi

echo "Setting up Python virtual environment..."
python -m venv "$pyroot"
if [ "$AGENT_OS" == "Windows_NT" ]; then
    "$pyroot/Scripts/activate"
else
    source "$pyroot/bin/activate"
fi
echo "Path is $PATH"

echo "Upgrading pip..."
python -m pip install --upgrade pip
pip install keyring artifacts-keyring

echo "Configuring private feed..."
# If the target conf file doesn't exist, pip config creates one at the user dir.
# This doesn't matter all that much for build agents.
touch "$conf_file"
pip config set global.index-url https://azurebatch.pkgs.visualstudio.com/_packaging/BatchExplorer/pypi/simple/
pip config list
