# Design Rules

## Colors

- Default black is `#1b1b1b`.
- Default black is already applied globally, so do not restate it unless a local override is needed.
- Default gray is `#9c9c9c`.
- Point color is `#0059ec`.
- Default border color is `#e8e8e8`.
- Button border color is `#dfdfdf`.

## Borders

- When two bordered controls sit side by side, use the same border color for both.
- Example: if a select box and button are adjacent, align both borders to either `#e8e8e8` or `#dfdfdf` instead of mixing them.

## Typography

- Default text size is `13px`.
- Default text size is already applied globally, so do not restate it unless a local override is needed.
- Page title text is `font-size:18px; font-weight:600;`.
- Font weight must not exceed `600`.
- Do not use `700`, `800`, or heavier weights.
- Use `600` only for page titles or genuinely emphasized text.
- Use `400` for normal text unless an existing local pattern requires otherwise.

## Buttons

- Default button border color is `#dfdfdf`.
- Default button text weight is `500`.

## Popups

- Use the "메일함 추가" popup as the base popup pattern.
- Popup title is `font-size:18px; font-weight:600;`.
- Popup close icon is `font-size:18px;`.
- Popup fields use `height:42px; line-height:42px; padding:0 12px; border-radius:5px; font-size:14px;`.

## Form Controls

- Use the browser/system default checkbox appearance.
- Do not customize checkbox styles beyond border color unless following a specific established pattern, such as the calendar "종일" control.
- Do not add custom checkbox checked colors or `appearance:none` styles unless the design explicitly requires that special pattern.
