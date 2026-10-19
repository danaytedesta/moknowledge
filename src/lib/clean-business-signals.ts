import type { BusinessSignals } from "@/lib/extract-business-signals";

// Filter obvious technical noise without changing owner-confirmed data.
// This runs on newly extracted candidates only.
export function cleanBusinessSignals(
  signals: BusinessSignals,
): BusinessSignals {
  const callsToAction = signals.callsToAction.filter((item) => {
    // Carousel and accessibility controls are not marketing actions.
    const isInterfaceControl =
      /\b(carousel|slideshow|slider|playback|screen reader|toggle|pause|stop)\b/i.test(
        item.value,
      );

    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item.value.trim());

    const isRecruitment =
      /\b(?:careers?|jobs?|hiring|vacanc(?:y|ies)|employment|our team|join the team)\b/i.test(
        item.snippet,
      );
    return !isInterfaceControl && !isEmail && !isRecruitment;
  });

  const logoUrls = signals.logoUrls.filter((item) => {
    try {
      const path = new URL(item.value).pathname;

      // Skip obvious placeholders and template-provider assets.
      if (
        /(?:^|[/_.-])placeholder(?:[/_.-]|$)/i.test(path) ||
        /\/default_template_images\//i.test(path)
      ) {
        return false;
      }

      // A picture of branded merchandise is not the logo itself.
      return !/\b(caps?|shirts?|t-shirts?|hoodies|merchandise)\b/i.test(
        item.snippet,
      );
    } catch {
      return false;
    }
  });

  // Normalize short hex notation so #FFF and #FFFFFF share one candidate.
  const colors: BusinessSignals["colors"] = [];

  for (const item of signals.colors) {
    let value = item.value.toUpperCase();

    if (/^#[0-9A-F]{3,4}$/.test(value)) {
      value = "#" + [...value.slice(1)].map((char) => char + char).join("");
    }

    if (!colors.some((existing) => existing.value === value)) {
      colors.push({ ...item, value });
    }
  }

  return {
    ...signals,
    callsToAction,
    logoUrls,
    colors,
  };
}
