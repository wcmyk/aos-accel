/**
 * Icons
 *
 * Google Material Symbols (Outlined), loaded as a font in index.html. Using
 * Google's own icon set keeps every glyph at one weight, size and optical
 * style — mixing hand-drawn SVGs, emoji and text glyphs read as patchwork.
 */
import React from 'react';

/** Material Symbols ligature names. Only names in this union are used. */
export type IconName =
  | 'add'
  | 'arrow_downward'
  | 'arrow_upward'
  | 'backspace'
  | 'candlestick_chart'
  | 'check'
  | 'close'
  | 'cloud_done'
  | 'cloud_off'
  | 'cloud_sync'
  | 'content_copy'
  | 'content_cut'
  | 'content_paste'
  | 'delete'
  | 'download'
  | 'error'
  | 'fit_screen'
  | 'format_bold'
  | 'format_color_fill'
  | 'format_color_text'
  | 'format_italic'
  | 'format_underlined'
  | 'functions'
  | 'insert_chart'
  | 'lock'
  | 'menu'
  | 'open_in_full'
  | 'play_arrow'
  | 'redo'
  | 'remove'
  | 'restart_alt'
  | 'search'
  | 'show_chart'
  | 'stop'
  | 'table_rows'
  | 'tune'
  | 'undo'
  | 'view_column'
  | 'visibility'
  | 'visibility_off';

export const Icon: React.FC<{ name: IconName; size?: number; className?: string }> = ({ name, size, className }) => (
  <span
    className={`material-symbols-outlined icon${className ? ` ${className}` : ''}`}
    style={size ? { fontSize: size } : undefined}
    aria-hidden="true"
  >
    {name}
  </span>
);

export const IconButton: React.FC<{
  icon: IconName;
  tooltip: string;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
  active?: boolean;
  label?: string;
}> = ({ icon, tooltip, onClick, className = 'ribbon-btn', disabled = false, active = false, label }) => (
  <button
    type="button"
    className={`${className}${active ? ' is-active' : ''}`}
    onClick={onClick}
    title={tooltip}
    aria-label={label ? undefined : tooltip}
    aria-pressed={active || undefined}
    disabled={disabled}
  >
    <Icon name={icon} />
    {label && <span className="icon-btn__label">{label}</span>}
  </button>
);

/**
 * Text or fill color picker styled like the Sheets toolbar: an icon with the
 * current color as a bar underneath; the native color input sits invisibly on
 * top so clicking opens the system picker.
 */
export const ColorButton: React.FC<{
  icon: IconName;
  tooltip: string;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}> = ({ icon, tooltip, value, disabled, onChange }) => (
  <label className={`ribbon-btn color-btn${disabled ? ' is-disabled' : ''}`} title={tooltip}>
    <Icon name={icon} />
    <span className="color-btn__bar" style={{ background: value }} />
    <input
      type="color"
      aria-label={tooltip}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    />
  </label>
);
