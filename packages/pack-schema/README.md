# @ll/pack-schema

The **contract** between the language-agnostic core and any language pack. Pure types — **no logic,
no language data**. If `core` needs to know a shape, it's defined here; a pack is just data that
conforms.

Changing a type here is a breaking change for every pack — treat it as the stable interface. The
language-specific escape hatch is `ReviewItem.meta` (and similar), so per-language fields (gender,
aspect, stress notes) don't require schema changes.
