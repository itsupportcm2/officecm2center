export const DEPARTMENTS=[
 'EC','HR','AP','AC','PC','IT','DC','LAB','R&D','QC','RM','PR','PA','ST','MC','SE','O&E','SERVICE',
] as const

export type Department=(typeof DEPARTMENTS)[number]
