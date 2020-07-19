/* eslint-disable jsx-a11y/anchor-has-content */
import React from 'react';
import PropTypes from 'prop-types';
import clsx from 'clsx';
import { useRouter } from 'next/router';
import { rewriteUrlForNextExport } from 'next/dist/next-server/lib/router/rewrite-url-for-export';
import NextLink from 'next/link';
import MuiLink from '@material-ui/core/Link';
import { useSelector } from 'react-redux';

const NextComposed = React.forwardRef(function NextComposed(props, ref) {
  const { as, href, prefetch, ...other } = props;

  return (
    <NextLink href={href} prefetch={prefetch} as={as}>
      <a ref={ref} {...other} />
    </NextLink>
  );
});

NextComposed.propTypes = {
  as: PropTypes.string,
  href: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
  prefetch: PropTypes.bool,
};

// A styled version of the Next.js Link component:
// https://nextjs.org/docs/#with-link
function Link(props) {
  const {
    activeClassName = 'active',
    as: asProp,
    className: classNameProps,
    href,
    innerRef,
    naked,
    role: roleProp,
    ...other
  } = props;
  const hrefPath =
    // eslint-disable-next-line no-nested-ternary
    typeof href === 'string'
      ? href
      : href != null
      ? // href object for next/link: { pathname: string, query?: string }
      href.pathname
      : undefined;

      /* eslint-disable-next-line */
  let asPath = rewriteUrlForNextExport(asProp || href);

  const userLanguage = useSelector((state) => state.options.userLanguage);
  if (userLanguage !== 'en' && hrefPath.indexOf('/') === 0 && hrefPath.indexOf('/blog') !== 0) {
    asPath = `/${userLanguage}${asPath}`;
  }

  // apply nextjs rewrites
  // const href = asPath.replace(/\/api-docs\/(.*)/, '/api/$1');

  const router = useRouter();
  const isActivePage = router.asPath === asPath;
  const className = clsx(classNameProps, {
    [activeClassName]: isActivePage && activeClassName,
  });

  // catch role passed from ButtonBase. This is definitely a link
  const role = roleProp === 'button' ? undefined : roleProp;

  // console.log('href Link');
 // console.log(href);
  const isExternal = hrefPath.indexOf('https:') === 0 || hrefPath.indexOf('mailto:') === 0;

  // console.log(isExternal);

  if (isExternal) {
    return <MuiLink className={className} href={hrefPath} ref={innerRef} role={role} {...other} />;
  }

  if (naked) {
    return <NextComposed as={asPath} className={className} href={href} ref={innerRef} role={role} {...other} />;
  }

  return (
    <MuiLink
      as={asPath}
      component={NextComposed}
      className={className}
      href={href}
      ref={innerRef}
      role={role}
      {...other}
    />
  );
}

Link.propTypes = {
  activeClassName: PropTypes.string,
  as: PropTypes.string,
  className: PropTypes.string,
  href: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
  innerRef: PropTypes.oneOfType([PropTypes.func, PropTypes.object]),
  naked: PropTypes.bool,
  onClick: PropTypes.func,
  prefetch: PropTypes.bool,
  role: PropTypes.string,
};

export default React.forwardRef((props, ref) => <Link {...props} innerRef={ref} />);
