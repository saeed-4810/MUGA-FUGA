interface NavigationTarget {
  assign: (path: string) => void;
  replace: (path: string) => void;
}

export const navigateTo = (path: string, target: NavigationTarget = window.location): void => {
  target.assign(path);
};

export const replaceWith = (path: string, target: NavigationTarget = window.location): void => {
  target.replace(path);
};
