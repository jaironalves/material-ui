import _ from 'lodash';
import { ReactApiJson, ReactApiI18n, ReactApiI18nJson } from 'react-doc';

function buildComponentApiI18n(reactApiJson: ReactApiJson): ReactApiI18n {
  const reactApiI18n: ReactApiI18n = { name: reactApiJson.name, description: null, props: [], styles: [] };
  
  if (reactApiJson.description) {
    reactApiI18n.description = {
      key: 'description',
      value: reactApiJson.description,
      path: 'description',
    };
  }

  _.forEach(reactApiJson.props, (value, key) => {
    if (!value.description) return;
    reactApiI18n.props.push({
      key: `prop${_.upperFirst(key)}`,
      value: value.description,
      path: `props.${key}.description`,
    });
  });

  _.forEach(reactApiJson.styles.descriptions, (value, key) => {
    if (!value) return;
    reactApiI18n.props.push({
      key: `styles${_.upperFirst(key)}`,
      value,
      path: `styles.descriptions.${key}`,
    });
  });

  // eslint-disable-next-line no-console
  console.log('Built API I18n data for', reactApiI18n.name);

  return reactApiI18n;
}

function buildComponentApiI18nJson(reactApiI18n: ReactApiI18n): ReactApiI18nJson {
  const reactApiI18nJson: ReactApiI18nJson = {};

  if (reactApiI18n.description) {
    reactApiI18nJson['description'] = reactApiI18n.description.value;
  }

  _.forEach(reactApiI18n.props, item => {
    reactApiI18nJson[item.key] = item.value;
  });

  _.forEach(reactApiI18n.styles, item => {
    reactApiI18nJson[item.key] = item.value;
  });

  // eslint-disable-next-line no-console
  console.log('Built API JSON I18n data for', reactApiI18n.name);

  return reactApiI18nJson;
}

export {
  buildComponentApiI18n,
  buildComponentApiI18nJson,
}
