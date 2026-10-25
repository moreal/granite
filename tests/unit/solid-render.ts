import { render as mount } from "@solidjs/web";
import type { JSX } from "@solidjs/web";
import { createSignal, flush } from "solid-js";
import { fireEvent as domFireEvent } from "@testing-library/dom";
export { screen, waitFor, within } from "@testing-library/dom";
export const fireEvent = new Proxy(domFireEvent, {
  get(target, key) {
    const fn = Reflect.get(target, key);
    return typeof fn === "function"
      ? (...args: unknown[]) => {
          const result = fn(...args);
          flush();
          return result;
        }
      : fn;
  },
  apply(target, _, args) {
    const result = Reflect.apply(target, undefined, args);
    flush();
    return result;
  },
});
const mounted = new Set<() => void>();
export function cleanup() {
  for (const dispose of mounted) dispose();
  mounted.clear();
}
export function act<T>(
  fn: () => T,
): T extends Promise<unknown> ? Promise<void> : void;
export function act(fn: () => unknown): void | Promise<void> {
  const result = fn();
  flush();
  if (result instanceof Promise)
    return result.then(() => {
      flush();
    });
}
export function render<P extends object>(
  component: (props: P) => JSX.Element,
  initial: NoInfer<P>,
) {
  const container = document.createElement("div");
  document.body.append(container);
  let update!: (value: P) => void;
  const dispose = mount(() => {
    const [props, setProps] = createSignal<P>(() => initial);
    update = (value) => setProps(() => value);
    return component(
      new Proxy(initial, { get: (_, key) => Reflect.get(props(), key) }),
    );
  }, container);
  const unmount = () => {
    dispose();
    container.remove();
    mounted.delete(unmount);
  };
  mounted.add(unmount);
  flush();
  return {
    container,
    unmount,
    rerender(props: P) {
      update(props);
      flush();
    },
  };
}
