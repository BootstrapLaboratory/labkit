# shellcheck shell=bash
# Devcontainer bash additions.
# This file is concatenated after /etc/skel/.bashrc at image build time.

if [[ $- == *i* ]]; then
	__devcontainer_history_hook='history -a; history -n'
	case ";${PROMPT_COMMAND-};" in
	*";${__devcontainer_history_hook};"*) ;;
	*)
		if [[ -n ${PROMPT_COMMAND-} ]]; then
			PROMPT_COMMAND="${__devcontainer_history_hook}; ${PROMPT_COMMAND}"
		else
			PROMPT_COMMAND="${__devcontainer_history_hook}"
		fi
		;;
	esac
	unset __devcontainer_history_hook

	shopt -s histappend
	HISTSIZE=10000
	HISTFILESIZE=20000

	if command -v dircolors >/dev/null 2>&1; then
		if dircolors_output="$(dircolors -b)"; then
			eval "${dircolors_output}"
			unset dircolors_output
		fi
		alias ls='ls --color=auto'
		alias grep='grep --color=auto'
	fi

	# Wrap non-printing ANSI escapes with \[...\] so readline cursor math works.
	if command -v tput >/dev/null 2>&1 && [[ -n ${TERM-} ]] && [[ ${TERM} != "dumb" ]]; then
		c_reset="\[$(tput sgr0)\]"
		c_user="\[$(tput setaf 10)\]"
		c_path="\[$(tput setaf 6)\]"
		c_root="\[$(tput setaf 9)\]"
		if [[ ${EUID} -eq 0 ]]; then
			PS1="${c_root}\u@\h ${c_path}\w${c_reset}# "
		else
			PS1="${c_user}\u@\h ${c_path}\w${c_reset}$ "
		fi
	elif [[ ${EUID} -eq 0 ]]; then
		PS1='\[\e[31m\]\u@\h \[\e[36m\]\w\[\e[0m\]# '
	else
		PS1='\[\e[32m\]\u@\h \[\e[36m\]\w\[\e[0m\]$ '
	fi

	if [[ -f /etc/bash_completion ]]; then
		# shellcheck disable=SC1091
		. /etc/bash_completion
	elif [[ -f /usr/share/bash-completion/bash_completion ]]; then
		# shellcheck disable=SC1091
		. /usr/share/bash-completion/bash_completion
	fi

	alias ll='ls -alF --color=auto'
	alias la='ls -A --color=auto'
	alias l='ls -CF --color=auto'
fi

if [[ -f "${HOME}/.bashrc_custom" ]]; then
	# shellcheck disable=SC1091
	. "${HOME}/.bashrc_custom"
fi
