import ReferenceEntryType from './data-type';

export type ToolType = {
  id: string;
  name: string;
  screen: string;
  icon: string;
};

export type CategoryType<T = ReferenceEntryType> = {
  id: string;
  title: string;
  icon: string;
  category: string;
  data: T[];
};

export type FlashlightModeType = {
  OFF: string;
  ON: string;
  STROBE: string;
  SOS: string;
  NIGHTVISION?: string;
};
