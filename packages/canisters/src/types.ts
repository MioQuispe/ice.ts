export type Opt<T> = [T] | []
export const Opt = <T>(value?: T): Opt<T> => {
  return (value || value === 0) ? ([value]) : []
}