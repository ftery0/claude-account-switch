# Claude Switch fish integration
# Auto-generated — do not edit manually

set -g __CLAUDE_PROFILES_DIR "$HOME/.claude-profiles"
set -g __CLAUDE_META_FILE "$__CLAUDE_PROFILES_DIR/meta.json"

# Resolve real claude binary path BEFORE our function shadows the name.
set -g __CLAUDE_SWITCH_REAL_BIN (command -v claude 2>/dev/null)

function __claude_switch_active
  if test -f $__CLAUDE_META_FILE
    node -e 'try{process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).activeProfile||"")}catch(e){}' "$__CLAUDE_META_FILE" 2>/dev/null
  end
end

function __claude_switch_profiles
  for d in $__CLAUDE_PROFILES_DIR/*/
    if test -d $d
      set name (basename $d)
      if not string match -q '_*' $name
        echo $name
      end
    end
  end
end

function __claude_switch_launch
  set -l profile $argv[1]
  set -e argv[1]
  if test -f "$__CLAUDE_PROFILES_DIR/$profile/.claude.json"
    echo (set_color cyan)"[claude-account-switch]"(set_color normal)" Profile: "(set_color --bold)$profile(set_color normal)
  else
    echo (set_color cyan)"[claude-account-switch]"(set_color normal)" Profile: "(set_color --bold)$profile(set_color normal)" "(set_color yellow)"(not logged in — login will start)"(set_color normal)
  end
  # Use cached binary; fallback to npm global root; error if not found
  set -l _bin $__CLAUDE_SWITCH_REAL_BIN
  if test -z "$_bin" -o ! -x "$_bin"
    set -l _npm_root (npm root -g 2>/dev/null)
    if test -n "$_npm_root" -a -f "$_npm_root/@anthropic-ai/claude-code/cli.js"
      set _bin "$_npm_root/@anthropic-ai/claude-code/cli.js"
    end
  end
  if test -z "$_bin"
    echo (set_color red)"[claude-account-switch]"(set_color normal)" Error: claude binary not found." >&2
    echo "  Run: npm install -g @anthropic-ai/claude-code" >&2
    return 127
  end
  set -x CLAUDE_CONFIG_DIR "$__CLAUDE_PROFILES_DIR/$profile"
  "$_bin" $argv
  set -e CLAUDE_CONFIG_DIR
end

function claude
  set -l profiles (__claude_switch_profiles)
  set -l count (count $profiles)

  if test $count -eq 0
    echo "No claude-account-switch profiles found. Run: npx claude-account-switch init" >&2
    return 1
  end

  if test $count -eq 1
    __claude_switch_launch $profiles[1] $argv
    return
  end

  set -l current (__claude_switch_active)
  set -l selected ""

  if test -f "$__CLAUDE_PROFILES_DIR/.picker.mjs"; and command -v node >/dev/null 2>&1
    set selected (node "$__CLAUDE_PROFILES_DIR/.picker.mjs" </dev/tty)
    if test -z "$selected"
      return 1
    end
  else
    echo ""
    echo (set_color cyan)"[claude-account-switch]"(set_color normal)" Select a profile:"
    echo ""
    for i in (seq 1 $count)
      set -l p $profiles[$i]
      set -l marker " "
      set -l login_status ""
      if test "$p" = "$current"
        set marker (set_color green)">"(set_color normal)
      end
      if not test -f "$__CLAUDE_PROFILES_DIR/$p/.claude.json"
        set login_status " "(set_color yellow)"(not logged in)"(set_color normal)
      end
      echo "  $marker $i) $p$login_status"
    end
    echo ""
    read -P "  Enter number (default: $current): " choice
    if test -z "$choice"
      set selected $current
    else if string match -qr '^[0-9]+$' "$choice"
      and test $choice -ge 1
      and test $choice -le $count
      set selected $profiles[$choice]
    end
    if test -z "$selected"
      echo "Invalid selection" >&2
      return 1
    end
  end

  if test "$selected" != "$current"
    cpf $selected >/dev/null
  end

  echo ""
  __claude_switch_launch $selected $argv
end

function cpf
  if test -z "$argv[1]"
    echo "Usage: cpf <profile-name>" >&2
    return 1
  end
  if not test -d "$__CLAUDE_PROFILES_DIR/$argv[1]"
    echo "Profile \"$argv[1]\" not found" >&2
    return 1
  end
  node -e 'var fs=require("fs"),f=process.argv[1],m=JSON.parse(fs.readFileSync(f,"utf8"));m.activeProfile=process.argv[2];fs.writeFileSync(f,JSON.stringify(m,null,2))' "$__CLAUDE_META_FILE" "$argv[1]" 2>/dev/null
  echo "Switched to profile: $argv[1]"
end

function claude-pick
  if test -f "$__CLAUDE_PROFILES_DIR/.picker.mjs"; and command -v node >/dev/null 2>&1
    set -l selected (node "$__CLAUDE_PROFILES_DIR/.picker.mjs" </dev/tty)
    if test -z "$selected"
      return 1
    end
    cpf $selected
  else
    set -l profiles (__claude_switch_profiles)
    if test -z "$profiles"
      echo "No profiles found. Run: npx claude-account-switch init" >&2
      return 1
    end
    set -l current (__claude_switch_active)
    echo "Select a profile:"
    for i in (seq 1 (count $profiles))
      set -l p $profiles[$i]
      set -l marker ""
      if test "$p" = "$current"
        set marker " *"
      end
      echo "  $i) $p$marker"
    end
    read -P "Enter number: " choice
    if string match -qr '^[0-9]+$' "$choice"
      and test $choice -ge 1
      and test $choice -le (count $profiles)
      cpf $profiles[$choice]
    else
      echo "Invalid selection" >&2
    end
  end
end
