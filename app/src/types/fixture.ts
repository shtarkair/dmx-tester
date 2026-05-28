export type ChannelType =
  | 'Intensity'
  | 'Red'
  | 'Green'
  | 'Blue'
  | 'White'
  | 'Amber'
  | 'UV'
  | 'Lime'
  | 'Cyan'
  | 'Magenta'
  | 'Yellow'
  | 'CTC'
  | 'CTO'
  | 'CTB'
  | 'Pan'
  | 'PanFine'
  | 'Tilt'
  | 'TiltFine'
  | 'Zoom'
  | 'Focus'
  | 'Iris'
  | 'Gobo'
  | 'Color'
  | 'Shutter'
  | 'Strobe'
  | 'Prism'
  | 'Frost'
  | 'Speed'
  | 'Control'
  | 'Macro'
  | 'Other';

export interface FixtureChannel {
  offset: number;
  type: ChannelType;
  name: string;
  fine: boolean;
  defaultValue: number;
}

export interface FixtureMode {
  id: string;
  name: string;
  channelCount: number;
  channels: FixtureChannel[];
}

export interface FixtureDefinition {
  id: string;
  name: string;
  manufacturer: string;
  modes: FixtureMode[];
  source: 'gdtf' | 'manual';
  importedAt: number;
}

export interface PatchedFixture {
  id: string;
  definitionId: string;
  modeId: string;
  name: string;
  universe: number;
  startChannel: number;
}

export interface ResolvedChannel {
  channel: number;
  fixtureId: string;
  fixtureName: string;
  parameter: FixtureChannel;
}

const TYPE_LABELS: Record<ChannelType, string> = {
  Intensity: 'Dim',
  Red: 'R',
  Green: 'G',
  Blue: 'B',
  White: 'W',
  Amber: 'A',
  UV: 'UV',
  Lime: 'Lm',
  Cyan: 'C',
  Magenta: 'M',
  Yellow: 'Y',
  CTC: 'CTC',
  CTO: 'CTO',
  CTB: 'CTB',
  Pan: 'Pan',
  PanFine: 'P↓',
  Tilt: 'Tilt',
  TiltFine: 'T↓',
  Zoom: 'Z',
  Focus: 'F',
  Iris: 'Ir',
  Gobo: 'Go',
  Color: 'Col',
  Shutter: 'Sh',
  Strobe: 'St',
  Prism: 'Pr',
  Frost: 'Fr',
  Speed: 'Spd',
  Control: 'Ctl',
  Macro: 'Mac',
  Other: '–',
};

export function shortLabel(type: ChannelType): string {
  return TYPE_LABELS[type] ?? '–';
}

export function fixtureColor(type: ChannelType): string {
  switch (type) {
    case 'Intensity':
      return '#fff5a0';
    case 'Red':
      return '#ff7070';
    case 'Green':
      return '#7be58a';
    case 'Blue':
      return '#80b0ff';
    case 'White':
      return '#f5f5f5';
    case 'Amber':
      return '#ffc070';
    case 'UV':
      return '#c080ff';
    case 'Cyan':
      return '#80e6f0';
    case 'Magenta':
      return '#ff80d0';
    case 'Yellow':
      return '#ffe080';
    case 'Lime':
      return '#c4f060';
    case 'Pan':
    case 'PanFine':
      return '#d0e6ff';
    case 'Tilt':
    case 'TiltFine':
      return '#d0e6ff';
    default:
      return '#e8e8e8';
  }
}
