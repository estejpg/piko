(function () {
  // Shared stroke attrs keep every glyph optically matched at the dock's 16px size.
  const S = 'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';

  // Marquee corners used by both Select and Thumbnail so those actions stay visually related.
  const MARQUEE =
    `<path d="M7 5H6C4.34315 5 3 6.34315 3 8V9M17 5H18C19.6569 5 21 6.34315 21 8V9M21 15V16C21 17.6569 19.6569 19 18 19H17M7 19H6C4.34315 19 3 17.6569 3 16V15" ${S}/>`;

  const CELL =
    (x, y) =>
      `<path d="M${x} ${y + 2}C${x} ${y + 0.89543} ${x + 0.89543} ${y} ${x + 2} ${y}H${x + 4}C${x + 5.10457} ${y} ${x + 6} ${y + 0.89543} ${x + 6} ${y + 2}V${y + 4}C${x + 6} ${y + 5.10457} ${x + 5.10457} ${y + 6} ${x + 4} ${y + 6}H${x + 2}C${x + 0.89543} ${y + 6} ${x} ${y + 5.10457} ${x} ${y + 4}V${y + 2}Z" ${S}/>`;

  const ICONS = {
    check: `<path d="M15 9.5L10.5 15L8.5 13M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" ${S}/>`,
    clear: `<path d="M15 9L9 15M15 15L9 9M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" ${S}/>`,
    download: `<path d="M20 15V17C20 18.6569 18.6569 20 17 20H7C5.34315 20 4 18.6569 4 17V15M12 14.5V4M12 14.5L8.5 11M12 14.5L15.5 11" ${S}/>`,
    folder: `<path d="M8.75736 4H6C4.34315 4 3 5.34315 3 7V16C3 17.6569 4.34315 19 6 19H18C19.6569 19 21 17.6569 21 16V9C21 7.34315 19.6569 6 18 6H13.2426C12.447 6 11.6839 5.68393 11.1213 5.12132L10.8787 4.87868C10.3161 4.31607 9.55301 4 8.75736 4Z" ${S}/><path d="M21 13C21 11.3431 19.6569 10 18 10H6C4.34315 10 3 11.3431 3 13" ${S}/>`,
    // Four matching rounded squares (previous bottom-right cell was a circle).
    grid: `${CELL(4, 4)}${CELL(4, 14)}${CELL(14, 4)}${CELL(14, 14)}`,
    // Distinct image glyph — was an accidental duplicate of grid.
    media: `<path d="M5 5H19C20.1046 5 21 5.89543 21 7V17C21 18.1046 20.1046 19 19 19H5C3.89543 19 3 18.1046 3 17V7C3 5.89543 3.89543 5 5 5Z" ${S}/><path d="M3 15.5L7.5 11.5L11 15L15 12L21 17" ${S}/><path d="M9 9.5C9 10.3284 8.32843 11 7.5 11C6.67157 11 6 10.3284 6 9.5C6 8.67157 6.67157 8 7.5 8C8.32843 8 9 8.67157 9 9.5Z" ${S}/>`,
    select: `${MARQUEE}<path d="M9 12L11 14L15 9.5" ${S}/>`,
    transcript: `<path d="M7 4H15L19 8V19C19 20.1046 18.1046 21 17 21H7C5.89543 21 5 20.1046 5 19V6C5 4.89543 5.89543 4 7 4Z" ${S}/><path d="M14 4V9H19M8.5 13H15.5M8.5 16.5H14" ${S}/>`,
    // Reels: portrait frame + play — reads clearly at 16px (old side-arcs looked like a circle/squircle).
    reel: `<path d="M8 4H16C17.1046 4 18 4.89543 18 6V18C18 19.1046 17.1046 20 16 20H8C6.89543 20 6 19.1046 6 18V6C6 4.89543 6.89543 4 8 4Z" ${S}/><path d="M11 9.5L15 12L11 14.5V9.5Z" ${S}/>`,
    // Classic 6-tooth cog — stays open/legible at the dock's 16px size.
    settings: `<path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" ${S}/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" ${S}/>`,
    spinner: '<path d="M21 12a9 9 0 0 1-9 9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    thumbnail: MARQUEE,
    visible: `<path d="M15 12C15 13.6569 13.6569 15 12 15C10.3431 15 9 13.6569 9 12C9 10.3431 10.3431 9 12 9C13.6569 9 15 10.3431 15 12Z" ${S}/><path d="M21.2246 10.6522C16.4094 3.11588 7.59077 3.11597 2.77557 10.6523C2.25157 11.4724 2.25157 12.5277 2.77557 13.3478C7.59077 20.8841 16.4094 20.884 21.2246 13.3477C21.7486 12.5276 21.7486 11.4723 21.2246 10.6522Z" ${S}/>`
  };
  ICONS.cancel = ICONS.clear;

  function icon(name, className) {
    const paths = ICONS[name] || ICONS.download;
    const classAttr = className ? ` ${className}` : "";
    return `<svg class="ig-bulk-icon${classAttr}" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">${paths}</svg>`;
  }

  function dockButton(action, ariaLabel, iconName, label, options) {
    const pressed = options && options.pressed != null ? ` aria-pressed="${options.pressed ? "true" : "false"}"` : "";
    const defaultTitle = options && options.persistDefaultTitle !== false ? ` data-default-title="${ariaLabel}"` : "";
    return [
      `<button type="button" class="ig-bulk-icon-button" data-action="${action}" data-label="${label}"${defaultTitle} aria-label="${ariaLabel}" title="${ariaLabel}"${pressed}>`,
      icon(iconName),
      `<span>${label}</span>`,
      "</button>"
    ].join("");
  }

  window.IgBulkIcons = { icon, dockButton };
})();
