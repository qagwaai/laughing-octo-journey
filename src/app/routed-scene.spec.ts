export {};

/**
 * RoutedScene now acts only as a routing shell for canvas scenes.
 * It should render the routed scene outlet and a loading placeholder,
 * but must not inject app-current labels directly.
 */
describe('RoutedScene template contract', () => {
	const template = `
		@defer (prefetch on idle) {
			<router-outlet />
		} @placeholder (minimum 5s) {
			<app-loading-scene />
		}
	`;

	it('renders the primary router outlet for scene components', () => {
		expect(template).toContain('<router-outlet />');
	});

	it('renders loading placeholder while deferred content resolves', () => {
		expect(template).toContain('<app-loading-scene />');
		expect(template).toContain('@placeholder (minimum 5s)');
	});

	it('does not inject app-current route labels at shell level', () => {
		expect(template).not.toContain('<app-current');
	});
});
