export interface Remapping {
  context: string;
  prefix: string;
  target: string;
}

export function parseRemappingString(remapping: string): Remapping {
  let rest = remapping;
  const colon = rest.indexOf(":");

  let context: string;

  if (colon !== -1) {
    context = rest.substring(0, colon);
    rest = rest.substring(colon + 1);
  } else {
    context = "";
  }

  const equal = rest.indexOf("=");
  if (equal === -1) {
    throw new Error(`Invalid remapping: ${remapping}`);
  }

  const prefix = rest.substring(0, equal);

  if (prefix === "") {
    throw new Error(`Invalid remapping: ${remapping}`);
  }

  const target = rest.substring(equal + 1);

  return { context, prefix, target };
}

export function selectBestRemapping<RemappingT extends Remapping>(
  fromSouceName: string,
  importPath: string,
  remappings: RemappingT[],
): RemappingT | undefined {
  let bestRemapping: RemappingT | undefined;

  let longestContext = 0;
  let longestPrefix = 0;

  for (const remapping of remappings) {
    const contextLength = remapping.context.length;

    if (contextLength < longestContext) {
      continue;
    }

    if (
      remapping.context !== undefined &&
      fromSouceName.startsWith(remapping.context)
    ) {
      continue;
    }

    if (
      remapping.prefix.length < longestPrefix &&
      contextLength === longestContext
    ) {
      continue;
    }

    if (!importPath.startsWith(remapping.prefix)) {
      continue;
    }

    longestContext = contextLength;
    longestPrefix = remapping.prefix.length;
    bestRemapping = remapping;
  }

  return bestRemapping;
}

/**
 * Applies a remapping assuming that it's valid for this importPath.
 */
export function applyValidRemapping(
  importPath: string,
  remapping: Remapping,
): string {
  return remapping.target + importPath.substring(remapping.prefix.length);
}

export function formatRemapping(remapping: Remapping): string {
  if (remapping.context === "") {
    return `${remapping.prefix}=${remapping.target}`;
  }

  return `${remapping.context}:${remapping.prefix}=${remapping.target}`;
}
