/* eslint-disable no-console */
import { mkdirSync, readdirSync, readFileSync } from 'fs';
import path from 'path';
import rimraf from 'rimraf';
import { writeJson } from 'fs-extra';
import * as _ from 'lodash';
import { defaultHandlers, parse as docgenParse } from 'react-docgen';
import { ReactApi, ReactApiData } from 'react-doc';
import * as yargs from 'yargs';
import muiDefaultPropsHandler from '../src/modules/utils/defaultPropsHandler';
import propJsdocHandler from '../src/modules/utils/propJsdocHandler';
import chainedPropHandler from '../src/modules/utils/chainedPropHandler';
import { createDescribeableProp } from '../src/modules/utils/generateMarkdown';
import {
  buildComponentApiI18n,
  buildComponentApiI18nJson,
} from '../src/modules/utils/generateDocs';
import { findPagesMarkdown, findComponents } from '../src/modules/utils/find';
import { getHeaders } from '../src/modules/utils/parseMarkdown';
import parseTest from '../src/modules/utils/parseTest';
import createMuiTheme from '../../packages/material-ui/src/styles/createMuiTheme';
import getStylesCreator from '../../packages/material-ui-styles/src/getStylesCreator';
import createGenerateClassName from '../../packages/material-ui-styles/src/createGenerateClassName';

const generateClassName = createGenerateClassName();

const rootDirectory = path.resolve(__dirname, '../../');
const theme = createMuiTheme();

const inheritedComponentRegexp = /\/\/ @inheritedComponent (.*)/;

/**
 * Receives a component's test information and source code and return's an object
 * containing the inherited component's name and pathname
 * @param testInfo Information retrieved from the component's describeConformance() in its test.js file
 * @param src The component's source code
 */
function getInheritance(
  testInfo: {
    /** The name of the component functionality is inherited from */
    inheritComponent: string | undefined;
  },
  src: string,
) {
  let inheritedComponentName = testInfo.inheritComponent;

  if (inheritedComponentName == null) {
    const match = src.match(inheritedComponentRegexp);
    if (match !== null) {
      inheritedComponentName = match[1];
    }
  }

  if (inheritedComponentName == null) {
    return null;
  }

  let pathname;

  switch (inheritedComponentName) {
    case 'Transition':
      pathname = 'https://reactcommunity.org/react-transition-group/transition#Transition-props';
      break;

    default:
      pathname = `/api/${_.kebabCase(inheritedComponentName)}`;
      break;
  }

  return {
    component: inheritedComponentName,
    pathname,
  };
}

const camelCaseToKebabCase = (inputString: string) => {
  const str = inputString.charAt(0).toLowerCase() + inputString.slice(1);
  return str.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2').toLowerCase();
};

async function updateStylesDefinition(context: {
  styles: ReactApi['styles'];
  component: { filename: string };
}) {
  const workspaceRoot = path.resolve(__dirname, '../../');
  const { styles, component } = context;

  const componentName = path.basename(component.filename).replace(/\.js$/, '');
  const dataFilename = `${workspaceRoot}/docs/data/${camelCaseToKebabCase(componentName)}.json`;

  try {
    const jsonDataString = readFileSync(dataFilename, { encoding: 'utf8' });
    const jsonData = JSON.parse(jsonDataString);
    if (jsonData) {
      const cssData = jsonData.css;
      const classes = Object.keys(cssData);
      styles.classes = classes;
      styles.name = jsonData.name;
      styles.descriptions = classes.reduce((acc, key) => {
        acc[key] = cssData[key].description;
        return acc;
      }, {} as Record<string, string>);
    }
  } catch (err) {
    // Do nothing for now if the file doesn't exist
    // This is still not supported for all components
  }
}

async function buildComponentApi(componentObject: { filename: string }) {
  const src = readFileSync(componentObject.filename, 'utf8');

  if (src.match(/@ignore - internal component\./) || src.match(/@ignore - do not document\./)) {
    return null;
  }

  const spread = !src.match(/ = exactProp\(/);

  // eslint-disable-next-line global-require, import/no-dynamic-require
  const component = require(componentObject.filename);
  const name = path.parse(componentObject.filename).name;

  const styles: ReactApi['styles'] = {
    classes: [],
    name: null,
    descriptions: {},
    globalClasses: {},
  };

  // styled components does not have the options static
  const styledComponent = !component?.default?.options;
  if (styledComponent) {
    await updateStylesDefinition({
      styles,
      component: componentObject,
    });
  }

  if (component.styles && component.default.options) {
    // Collect the customization points of the `classes` property.
    styles.classes = Object.keys(getStylesCreator(component.styles).create(theme)).filter(
      (className) => !className.match(/^(@media|@keyframes|@global)/),
    );
    styles.name = component.default.options.name;
    styles.globalClasses = styles.classes.reduce((acc, key) => {
      acc[key] = generateClassName(
        // @ts-expect-error
        {
          key,
        },
        {
          options: {
            name: styles.name,
            theme: {},
          },
        },
      );
      return acc;
    }, {} as Record<string, string>);

    let styleSrc = src;
    // Exception for Select where the classes are imported from NativeSelect
    if (name === 'Select') {
      styleSrc = readFileSync(
        componentObject.filename.replace(
          `Select${path.sep}Select`,
          `NativeSelect${path.sep}NativeSelect`,
        ),
        'utf8',
      );
    }

    /**
     * Collect classes comments from the source
     */
    const stylesRegexp = /export const styles.*[\r\n](.*[\r\n])*};[\r\n][\r\n]/;
    const styleRegexp = /\/\* (.*) \*\/[\r\n]\s*(\w*)/g;
    // Extract the styles section from the source
    const stylesSrc = stylesRegexp.exec(styleSrc);

    if (stylesSrc) {
      // Extract individual classes and descriptions
      stylesSrc[0].replace(styleRegexp, (match: string, desc: string, key: string) => {
        styles.descriptions[key] = desc;
        return match;
      });
    }
  }

  let reactAPI: ReactApi;
  try {
    reactAPI = docgenParse(
      src,
      null,
      defaultHandlers.concat(muiDefaultPropsHandler, propJsdocHandler, chainedPropHandler),
      {
        filename: componentObject.filename,
      },
    );
  } catch (err) {
    console.error('Error parsing src for', componentObject.filename);
    throw err;
  }

  reactAPI.props = _.mapValues(
    _.omitBy(reactAPI.props, (descriptor, propName) => {
      const describeableProp = createDescribeableProp(descriptor, propName);
      const hasIgnoreTag =
        describeableProp?.annotation.tags.find((tag) => tag.title === 'ignore') !== undefined;
      return hasIgnoreTag;
    }),
    ({ ...descriptor }) => {
      return descriptor;
    },
  );
  reactAPI.name = name;
  reactAPI.styles = styles;
  reactAPI.spread = spread;

  const testInfo = await parseTest(componentObject.filename);
  // no Object.assign to visually check for collisions
  reactAPI.forwardsRefTo = testInfo.forwardsRefTo;

  // Relative location in the file system.
  reactAPI.filename = componentObject.filename.replace(rootDirectory, '');
  reactAPI.inheritance = getInheritance(testInfo, src);

  if (reactAPI.styles.classes) {
    reactAPI.styles.globalClasses = reactAPI.styles.classes.reduce((acc, key) => {
      acc[key] = generateClassName(
        // @ts-expect-error
        {
          key,
        },
        {
          options: {
            name: styles.name,
            theme: {},
          },
        },
      );
      return acc;
    }, {} as Record<string, string>);
  }

  // eslint-disable-next-line no-console
  console.log('Built API data for', reactAPI.name);
  return reactAPI;
}

async function run(argv: {
  componentDirectories?: string[];
  grep?: string;
  outputDirectory?: string;
}) {
  const componentDirectories = argv.componentDirectories!.map((componentDirectory) => {
    return path.resolve(componentDirectory);
  });

  const outputDirectory = path.resolve(argv.outputDirectory!);
  const outputDirectoryComponents = path.join(outputDirectory, 'components');
  const outputDirectoryTranslations = path.join(outputDirectory, 'translations');

  rimraf.sync(outputDirectoryComponents);
  mkdirSync(outputDirectoryComponents, { mode: 0o777, recursive: true });
  mkdirSync(outputDirectoryTranslations, { mode: 0o777, recursive: true });

  const grep = argv.grep == null ? null : new RegExp(argv.grep);

  const components = componentDirectories
    .reduce((directories, componentDirectory) => {
      return directories.concat(findComponents(componentDirectory));
    }, [] as Array<{ filename: string }>)
    .filter((component) => {
      if (grep === null) {
        return true;
      }
      return grep.test(component.filename);
    });

  const pagesMarkdown = findPagesMarkdown().map((markdown) => {
    const markdownSource = readFileSync(markdown.filename, 'utf8');
    return {
      ...markdown,
      components: getHeaders(markdownSource).components,
    };
  });

  function findPagesOfComponent(componentName: string) {
    return Array.from(
      new Set(
        pagesMarkdown
          .filter((markdown) => {
            return markdown.components.includes(componentName);
          })
          .map((markdown) => {
            return markdown.pathname;
          }),
      ),
    );
  }

  const componentApisData: ReactApiData[] = [];

  await Promise.all(
    components
      // .filter((cp) => cp.filename.endsWith('Button.js'))
      .map(async (component) => {
        try {
          const componentApi = await buildComponentApi(component);
          if (componentApi !== null) {
            const usedInPages = findPagesOfComponent(componentApi.name);

            const componentApiJson = {
              ...componentApi,
              usedInPages,
            };
            const componentApiI18n = buildComponentApiI18n(componentApiJson);
            const componentApiI18nJson = buildComponentApiI18nJson(componentApiI18n);

            componentApisData.push({
              api: componentApiJson,
              i18n: componentApiI18n,
              i18nJson: componentApiI18nJson,
            });
          }
        } catch (error) {
          console.warn(`error building docs for ${component.filename}`);
          console.error(error);
          process.exit(1);
        }
      }),
  );

  const translationsExistDirs = readdirSync(outputDirectoryTranslations, { withFileTypes: true })
    .filter((dirEntry) => dirEntry.isDirectory())
    .map((dirEntry) => dirEntry.name);

  const transalationsDirs = Object.values(componentApisData).map(
    (apiData) => apiData.api.name,
  );

  // Clear removed components
  await Promise.all(
    _.difference(translationsExistDirs, transalationsDirs).map(async (dirname) => {
      const remover = path.join(outputDirectoryTranslations, dirname);

      // eslint-disable-next-line no-console
      return rimraf(remover, () => console.log(`Removing API translation directory ${dirname}`));
    }),
  );

  await Promise.all(
    Object.values(componentApisData).map(async (data) => {

      const apiName = data.api.name;

      const outputDirectoryTranslation = path.join(outputDirectoryTranslations, `${apiName}`);
      mkdirSync(outputDirectoryTranslation, { mode: 0o777, recursive: true });

      // eslint-disable-next-line no-console
      console.log('Writing API JSON data for', apiName);

      await writeJson(path.join(outputDirectoryComponents, `${apiName}.json`), data.api, {
        spaces: 2,
      });

      return writeJson(path.join(outputDirectoryTranslation, `${apiName}.json`), data.i18nJson, {
        spaces: 2,
      });
    }),
  );
}

yargs
  .command({
    command: '$0 <outputDirectory> [componentDirectories...]',
    describe: 'formats codebase',
    builder: (command) => {
      return command
        .positional('outputDirectory', {
          description: 'directory where the json is written to',
          type: 'string',
        })
        .positional('componentDirectories', {
          array: true,
          description: 'Directories to component sources',
          type: 'string',
        })
        .option('grep', {
          description:
            'Only generate markdown for component filenames matching the pattern. The string is treated as a RegExp.',
          type: 'string',
        });
    },
    handler: run,
  })
  .help()
  .strict(true)
  .version(false)
  .parse();
