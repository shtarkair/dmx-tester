import JSZip from 'jszip';
import { XMLParser } from 'fast-xml-parser';
import type {
  ChannelType,
  FixtureChannel,
  FixtureDefinition,
  FixtureMode,
} from '../types/fixture';

const ATTR_TO_TYPE: Record<string, ChannelType> = {
  Dimmer: 'Intensity',
  Intensity: 'Intensity',
  ColorAdd_R: 'Red',
  ColorRGB_Red: 'Red',
  ColorAdd_G: 'Green',
  ColorRGB_Green: 'Green',
  ColorAdd_B: 'Blue',
  ColorRGB_Blue: 'Blue',
  ColorAdd_W: 'White',
  ColorAdd_WW: 'White',
  ColorAdd_CW: 'White',
  ColorAdd_A: 'Amber',
  ColorAdd_UV: 'UV',
  ColorAdd_L: 'Lime',
  ColorSub_C: 'Cyan',
  ColorSub_M: 'Magenta',
  ColorSub_Y: 'Yellow',
  CTC: 'CTC',
  CTO: 'CTO',
  CTB: 'CTB',
  Pan: 'Pan',
  Tilt: 'Tilt',
  Zoom: 'Zoom',
  Focus: 'Focus',
  Iris: 'Iris',
  Gobo1: 'Gobo',
  Gobo2: 'Gobo',
  Color1: 'Color',
  Color2: 'Color',
  Shutter1: 'Shutter',
  Shutter1Strobe: 'Strobe',
  StrobeDuration: 'Strobe',
  Prism1: 'Prism',
  Frost1: 'Frost',
  GoboWheelSpeed: 'Speed',
  Control1: 'Control',
  Macro: 'Macro',
};

function mapAttribute(attr: string): ChannelType {
  if (!attr) return 'Other';
  const direct = ATTR_TO_TYPE[attr];
  if (direct) return direct;

  const lower = attr.toLowerCase();
  if (lower.startsWith('dimmer')) return 'Intensity';
  if (lower.includes('red')) return 'Red';
  if (lower.includes('green')) return 'Green';
  if (lower.includes('blue')) return 'Blue';
  if (lower.includes('white')) return 'White';
  if (lower.includes('amber')) return 'Amber';
  if (lower.includes('uv')) return 'UV';
  if (lower.startsWith('pan')) return 'Pan';
  if (lower.startsWith('tilt')) return 'Tilt';
  if (lower.startsWith('zoom')) return 'Zoom';
  if (lower.startsWith('focus')) return 'Focus';
  if (lower.startsWith('iris')) return 'Iris';
  if (lower.startsWith('gobo')) return 'Gobo';
  if (lower.startsWith('color')) return 'Color';
  if (lower.startsWith('shutter')) return 'Shutter';
  if (lower.startsWith('strobe')) return 'Strobe';
  if (lower.startsWith('prism')) return 'Prism';
  if (lower.startsWith('frost')) return 'Frost';
  return 'Other';
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function parseOffsets(raw: unknown): number[] {
  if (typeof raw !== 'string') return [];
  return raw
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0);
}

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

interface RawDescription {
  GDTF?: {
    FixtureType?: {
      '@_Name'?: string;
      '@_Manufacturer'?: string;
      '@_LongName'?: string;
      '@_ShortName'?: string;
      DMXModes?: {
        DMXMode?: RawMode | RawMode[];
      };
    };
  };
}

interface RawMode {
  '@_Name'?: string;
  DMXChannels?: {
    DMXChannel?: RawChannel | RawChannel[];
  };
}

interface RawChannel {
  '@_Offset'?: string;
  '@_InitialFunction'?: string;
  '@_Geometry'?: string;
  '@_Default'?: string;
  LogicalChannel?: RawLogicalChannel | RawLogicalChannel[];
}

interface RawLogicalChannel {
  '@_Attribute'?: string;
  ChannelFunction?: RawChannelFunction | RawChannelFunction[];
}

interface RawChannelFunction {
  '@_Name'?: string;
  '@_Attribute'?: string;
  '@_Default'?: string;
}

function parseDmxValue(raw: string | undefined): number {
  if (!raw) return 0;
  const parts = raw.split('/');
  const v = parseInt(parts[0], 10);
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(255, v));
}

function attributeFromChannel(channel: RawChannel): string {
  const lc = asArray(channel.LogicalChannel);
  if (lc.length > 0 && lc[0]['@_Attribute']) {
    return lc[0]['@_Attribute']!;
  }
  if (channel['@_InitialFunction']) {
    const parts = channel['@_InitialFunction'].split('.');
    if (parts.length >= 2) return parts[1];
  }
  const fns = lc.flatMap((l) => asArray(l.ChannelFunction));
  if (fns.length > 0 && fns[0]['@_Attribute']) {
    return fns[0]['@_Attribute']!;
  }
  return 'Other';
}

function defaultFromChannel(channel: RawChannel): number {
  if (channel['@_Default']) return parseDmxValue(channel['@_Default']);
  const lc = asArray(channel.LogicalChannel);
  const fns = lc.flatMap((l) => asArray(l.ChannelFunction));
  if (fns.length > 0 && fns[0]['@_Default']) {
    return parseDmxValue(fns[0]['@_Default']);
  }
  return 0;
}

function buildMode(raw: RawMode): FixtureMode {
  const name = raw['@_Name'] ?? 'Mode';
  const channels: FixtureChannel[] = [];
  const rawChannels = asArray(raw.DMXChannels?.DMXChannel);

  let maxOffset = 0;
  for (const rc of rawChannels) {
    const offsets = parseOffsets(rc['@_Offset']);
    if (offsets.length === 0) continue;

    const attr = attributeFromChannel(rc);
    const type = mapAttribute(attr);
    const def = defaultFromChannel(rc);

    offsets.forEach((offset1, i) => {
      const isFine = i > 0;
      let fineType: ChannelType = type;
      if (isFine) {
        if (type === 'Pan') fineType = 'PanFine';
        else if (type === 'Tilt') fineType = 'TiltFine';
      }
      channels.push({
        offset: offset1,
        type: fineType,
        name: isFine ? `${attr} fine` : attr,
        fine: isFine,
        defaultValue: isFine ? 0 : def,
      });
      if (offset1 > maxOffset) maxOffset = offset1;
    });
  }

  channels.sort((a, b) => a.offset - b.offset);

  return {
    id: makeId(),
    name,
    channelCount: maxOffset,
    channels,
  };
}

export async function parseGdtfFile(base64Content: string): Promise<FixtureDefinition> {
  const zip = await JSZip.loadAsync(base64Content, { base64: true });
  const descriptionEntry = zip.file('description.xml') ?? zip.file('Description.xml');
  if (!descriptionEntry) {
    throw new Error('GDTF: description.xml not found in archive');
  }
  const xmlText = await descriptionEntry.async('string');

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    allowBooleanAttributes: true,
    parseAttributeValue: false,
    trimValues: true,
  });

  const parsed = parser.parse(xmlText) as RawDescription;
  const fixtureType = parsed.GDTF?.FixtureType;
  if (!fixtureType) {
    throw new Error('GDTF: <FixtureType> not found');
  }

  const name =
    fixtureType['@_LongName'] || fixtureType['@_Name'] || fixtureType['@_ShortName'] || 'Unnamed';
  const manufacturer = fixtureType['@_Manufacturer'] || 'Unknown';

  const rawModes = asArray(fixtureType.DMXModes?.DMXMode);
  if (rawModes.length === 0) {
    throw new Error('GDTF: no DMX modes found');
  }
  const modes = rawModes.map(buildMode).filter((m) => m.channelCount > 0);
  if (modes.length === 0) {
    throw new Error('GDTF: every parsed mode had zero channels');
  }

  return {
    id: makeId(),
    name,
    manufacturer,
    modes,
    source: 'gdtf',
    importedAt: Date.now(),
  };
}
