declare module 'react-doc' {
  import { Annotation } from 'doctrine';
  import {        
    PropTypeDescriptor,
    ReactDocgenApi,
  } from 'react-docgen';

  export interface DescribeablePropDescriptor {
    annotation: Annotation;
    defaultValue: string | null;
    required: boolean;
    type: PropTypeDescriptor;
  }

  export interface ReactApi extends ReactDocgenApi {
    EOL: string;
    filename: string;
    forwardsRefTo: string | undefined;
    inheritance: { component: string; pathname: string } | null;
    name: string;
    pagesMarkdown: Array<{ components: string[]; filename: string; pathname: string }>;
    spread: boolean;
    src: string;
    styles: {
      classes: string[];
      globalClasses: Record<string, string>;
      name: string | null;
      descriptions: Record<string, string>;
    };
  }
  
  export interface ReactApiJson extends ReactApi {
    usedInPages: string[]
  }

  export interface I18nItem {
    key: string,
    value: string;
    path: string;
  }

  interface ReactApiI18n {
    name: string;
    description: I18nItem | null;
    props: I18nItem[];
    styles: I18nItem[];
  }

  export interface ReactApiI18nJson extends Record<string, string>{}

  export interface ReactApiData {
    api: ReactApiJson,
    i18n: ReactApiI18n;
    i18nJson: ReactApiI18nJson;
  }

  // export interface ReactApiI18n {
  //   description: string | null;
  //   props: Record<string, string>;
  //   styles: Record<string, string>;
  // }

}