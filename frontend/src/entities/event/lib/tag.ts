/** A `v` prefix marks a view-through event (happened without a click). */
export const isViewThrough = (tag: string) => tag.startsWith('v')
