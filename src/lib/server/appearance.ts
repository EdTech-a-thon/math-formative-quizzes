import { isShade, type ShadeId } from "$lib/shades";
import { pickerIcons } from "$lib/pickerIcons";

// Anything the browser sends for a record's look is narrowed to an icon the
// picker actually offers and one of the four house shades before it is stored.
export function appearanceOf(body: { icon?: unknown; shade?: unknown }): { icon: string; shade: ShadeId | "" } {
  return {
    icon: typeof body.icon === "string" && body.icon in pickerIcons ? body.icon : "",
    shade: isShade(body.shade) ? body.shade : "",
  };
}
