// Shared guards for text that Vita produces or carries forward.

// The takeaway route emits a {thirdPerson, secondPerson} JSON object. When its
// parse there fails, or a carried-forward summary gets echoed by the model, that
// raw structure can leak into a coach message or into the context fed to the next
// call. This strips it: pull out the second-person ("you") text Vita would use, or
// fall back to the third-person field, or remove the JSON scaffolding entirely.
export function stripStructuredLeak(text: string): string {
  if (!text || !/["“]?(?:second|third)Person["”]?\s*:/.test(text)) return text;
  const second = text.match(
    /["“]?secondPerson["”]?\s*:\s*["“]([\s\S]*?)["”]\s*[,}]/
  );
  if (second?.[1]) return second[1].trim();
  const third = text.match(
    /["“]?thirdPerson["”]?\s*:\s*["“]([\s\S]*?)["”]\s*[,}]/
  );
  if (third?.[1]) return third[1].trim();
  return text
    .replace(/[{}]/g, "")
    .replace(/["“]?(?:second|third)Person["”]?\s*:/g, "")
    .trim();
}
