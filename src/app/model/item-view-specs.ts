export interface FieldConfig {
	label: string;
	getValue: (item: unknown) => unknown;
	format?: (value: unknown) => string;
}

export interface FieldGroupConfig {
	label: string;
	fields: FieldConfig[];
}

export interface ItemViewSpecsConfig {
	itemType: string;
	title: string;
	groups: FieldGroupConfig[];
}

export interface ResolvedField {
	label: string;
	displayValue: string;
}

export interface ResolvedGroup {
	label: string;
	fields: ResolvedField[];
}

export function resolveGroups(config: ItemViewSpecsConfig, item: unknown): ResolvedGroup[] {
	return config.groups
		.map(group => ({
			label: group.label,
			fields: group.fields
				.map(field => {
					const value = field.getValue(item);
					if (value === null || value === undefined) return null;
					return {
						label: field.label,
						displayValue: field.format ? field.format(value) : String(value),
					};
				})
				.filter((f): f is ResolvedField => f !== null),
		}))
		.filter(g => g.fields.length > 0);
}

export function normalizeItemTypeForImage(itemType: string): string {
	return itemType
		.toLowerCase()
		.replace(/-/g, '_')
		.replace(/[^a-z0-9\s_]/g, '')
		.replace(/\s+/g, '_')
		.trim();
}

export function getSpecsImagePath(itemType: string): string {
	return `images/${normalizeItemTypeForImage(itemType)}_specs.png`;
}
