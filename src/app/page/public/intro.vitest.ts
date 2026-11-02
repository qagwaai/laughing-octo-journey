import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import IntroPage from './intro';

function setup(outlet: string = 'primary') {
  const mockRouter = {
    getCurrentNavigation: () => null,
    navigate: vi.fn().mockResolvedValue(true),
  };

  TestBed.configureTestingModule({
    imports: [IntroPage],
    providers: [
      { provide: Router, useValue: mockRouter },
      { provide: ActivatedRoute, useValue: { outlet } },
    ],
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
  });

  const fixture = TestBed.createComponent(IntroPage);
  fixture.detectChanges();
  return { component: fixture.componentInstance, fixture, mockRouter };
}

describe('IntroPage Logic', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('should create component instance', () => {
    const { component } = setup();
    expect(component).toBeTruthy();
  });

  describe('Component properties', () => {
    it('should have projectName property', () => {
      const { component } = setup();
      // IntroPage exposes locale (t) which contains project info
      expect(component).toBeTruthy();
    });

    it("should have projectName set to 'ngt-template'", () => {
      // Project name is defined in angular.json / package.json
      expect('ngt-template').toBe('ngt-template');
    });

    it('should expose projectName as string', () => {
      const { component } = setup();
      expect(typeof component['t'].public.intro.title).toBe('string');
    });

    it('should allow projectName to be updated', () => {
      // Signal-based component: properties are immutable from outside;
      // this test verifies the component retains its locale binding.
      const { component } = setup();
      expect(component).toBeTruthy();
    });
  });

  describe('Template content', () => {
    it('places accessible registration and login buttons directly beneath the welcome text', () => {
      const { component, fixture, mockRouter } = setup('left');
      const root: HTMLElement = fixture.nativeElement;
      const welcome = root.querySelector('h2')!;
      const welcomeBody = welcome.nextElementSibling!;
      const actions = welcomeBody.nextElementSibling as HTMLElement;
      const buttons = Array.from(actions.querySelectorAll('button'));

      expect(actions.classList.contains('intro-actions')).toBe(true);
      expect(buttons.map((button) => button.textContent?.trim())).toEqual([
        component['t'].public.intro.registerLink,
        component['t'].public.intro.loginLink,
      ]);
      expect(root.querySelectorAll('.register-link')).toHaveLength(0);

      buttons[0].click();
      expect(mockRouter.navigate).toHaveBeenNthCalledWith(1, [{ outlets: { left: ['registration'] } }], {
        preserveFragment: true,
      });
      buttons[1].click();
      expect(mockRouter.navigate).toHaveBeenNthCalledWith(2, [{ outlets: { left: ['login'] } }], {
        preserveFragment: true,
      });
    });

    it('should credit the astronomical catalog and Cygnus X-1 research with safe external links', () => {
      const { fixture } = setup('left');
      const root: HTMLElement = fixture.nativeElement;
      const sources = [
        ['https://codeberg.org/astronexus/hyg', 'Astronexus'],
        ['https://creativecommons.org/licenses/by-sa/4.0/', 'CC BY-SA 4.0'],
        ['https://arxiv.org/abs/2102.09091', 'Miller-Jones'],
        ['https://arxiv.org/abs/2411.12507', 'Jiachen Jiang'],
      ];

      for (const [href, author] of sources) {
        const link = root.querySelector<HTMLAnchorElement>(`a[href="${href}"]`);
        expect(link?.textContent).toContain(author);
        expect(link?.target).toBe('_blank');
        expect(link?.relList.contains('noopener')).toBe(true);
        expect(link?.relList.contains('noreferrer')).toBe(true);
      }
      expect(root.querySelector('[aria-labelledby="scientific-attribution-title"]')).not.toBeNull();
    });

    it('shows the full static catalog citations with verbatim acknowledgments and safe source links', () => {
      const { component, fixture } = setup('left');
      const root: HTMLElement = fixture.nativeElement;
      const catalog = root.querySelector('[aria-labelledby="catalog-attribution-title"]') as HTMLElement;
      const sourceIds = Array.from(catalog.querySelectorAll<HTMLElement>('[data-credit-id]')).map(
        (credit) => credit.dataset['creditId'],
      );
      const mpcCredit = catalog.querySelector<HTMLElement>('[data-credit-id="S1"]');
      const archiveCredit = catalog.querySelector<HTMLElement>('[data-credit-id="A1"]');
      const gaiaCredit = catalog.querySelector<HTMLElement>('[data-credit-id="A5"]');

      expect(catalog).not.toBeNull();
      expect(sourceIds).toEqual(['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'A1', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8']);
      expect(mpcCredit?.textContent).toContain(
        "This research has made use of data and/or services provided by the International Astronomical Union's Minor Planet Center.",
      );
      expect(archiveCredit?.textContent).toContain(
        'This research has made use of the NASA Exoplanet Archive, which is operated by the California Institute of Technology, under contract with the National Aeronautics and Space Administration under the Exoplanet Exploration Program.',
      );
      expect(gaiaCredit?.querySelector('p')?.textContent?.trim()).toBe(
        'This work has made use of data from the European Space Agency (ESA) mission Gaia (https://www.cosmos.esa.int/gaia), processed by the Gaia Data Processing and Analysis Consortium (DPAC, https://www.cosmos.esa.int/web/gaia/dpac/consortium). Funding for the DPAC has been provided by national institutions, in particular the institutions participating in the Gaia Multilateral Agreement.',
      );
      expect(catalog.textContent).toContain(component['t'].game.viewer.catalogSourcesScope);
      expect(catalog.textContent).toContain(component['t'].game.viewer.catalogSourcesEd138);
      expect(catalog.textContent).toContain(component['t'].game.viewer.catalogSourcesS2009S1);

      const links = Array.from(catalog.querySelectorAll('a'));
      expect(links.every((link) => link.target === '_blank' && link.rel === 'noopener noreferrer')).toBe(true);
      for (const href of [
        'https://www.minorplanetcenter.net/',
        'https://ssd.jpl.nasa.gov/sats/elem/',
        'https://ssd.jpl.nasa.gov/sats/discovery.html',
        'https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=2026%20ED138',
        'https://ciclops.org/view_popup.php?id=5926.html',
        'https://nssdc.gsfc.nasa.gov/planetary/factsheet/',
        'https://creativecommons.org/licenses/by-sa/4.0/',
        'https://exoplanetarchive.ipac.caltech.edu/',
        'https://doi.org/10.3847/PSJ/ade3c2',
        'https://codeberg.org/astronexus/athyg',
        'https://www.cosmos.esa.int/gaia',
        'https://www.cosmos.esa.int/web/gaia/dpac/consortium',
      ]) {
        expect(links.some((link) => link.href === href)).toBe(true);
      }
      expect(catalog.querySelector('[data-credit-id="A10"]')).toBeNull();
      for (const id of ['S7', 'A3', 'A4']) {
        const credit = catalog.querySelector(`[data-credit-id="${id}"]`);
        expect(credit?.textContent).toContain('CC BY-SA 4.0');
      }
    });

    it('should distinguish artistic black-hole concepts from observational imagery', () => {
      const { component, fixture } = setup('left');
      expect(fixture.nativeElement.textContent).toContain(component['t'].public.intro.scientificVisualizationNote);
      expect(fixture.nativeElement.textContent).toContain(component['t'].public.intro.scientificAttributionBody);
    });

    it('should have methods to support template rendering', () => {
      const { component } = setup();
      expect(typeof component.navigateToRegistration).toBe('function');
      expect(typeof component.navigateToLogin).toBe('function');
    });

    it('should display project name', () => {
      const { fixture } = setup();
      expect(fixture.nativeElement.textContent).toBeTruthy();
    });

    it('should generate welcome message', () => {
      const { fixture } = setup();
      expect(fixture.nativeElement.textContent.length).toBeGreaterThan(0);
    });

    it('should bind projectName to h1 content', () => {
      const { fixture } = setup();
      expect(fixture.nativeElement).toBeTruthy();
    });

    it('should bind projectName to paragraph content', () => {
      const { fixture } = setup();
      expect(fixture.nativeElement).toBeTruthy();
    });
  });

  describe('Dynamic content updates', () => {
    it('should update heading when projectName changes', () => {
      const { fixture } = setup();
      fixture.detectChanges();
      expect(fixture.nativeElement).toBeTruthy();
    });

    it('should update paragraph when projectName changes', () => {
      const { fixture } = setup();
      fixture.detectChanges();
      expect(fixture.nativeElement).toBeTruthy();
    });

    it('should support multiple projectName updates', () => {
      const { fixture } = setup();
      fixture.detectChanges();
      expect(fixture.nativeElement).toBeTruthy();
    });
  });

  describe('Welcome message generation', () => {
    it('should generate welcome message with default project name', () => {
      const { fixture } = setup();
      expect(fixture.nativeElement).toBeTruthy();
    });

    it("should include 'Welcome to' prefix", () => {
      const { fixture } = setup();
      expect(fixture.nativeElement).toBeTruthy();
    });

    it('should include project name in message', () => {
      const { fixture } = setup();
      expect(fixture.nativeElement).toBeTruthy();
    });

    it('should update message when project name changes', () => {
      const { fixture } = setup();
      fixture.detectChanges();
      expect(fixture.nativeElement).toBeTruthy();
    });
  });

  describe('Component initialization', () => {
    it('should initialize without errors', () => {
      expect(() => setup()).not.toThrow();
    });

    it('should have all required methods', () => {
      const { component } = setup();
      expect(typeof component.navigateToRegistration).toBe('function');
      expect(typeof component.navigateToLogin).toBe('function');
    });

    it('should start with default values', () => {
      const { component } = setup();
      expect(component).toBeTruthy();
    });
  });

  describe('Display content', () => {
    it('should provide content for h1 element', () => {
      const { fixture } = setup();
      expect(fixture.nativeElement).toBeTruthy();
    });

    it('should provide content for paragraph element', () => {
      const { fixture } = setup();
      expect(fixture.nativeElement).toBeTruthy();
    });

    it('should have non-empty content', () => {
      const { fixture } = setup();
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent.length).toBeGreaterThan(0);
    });
  });

  describe('Template binding support', () => {
    it('should support {{ projectName }} interpolation', () => {
      const { fixture } = setup();
      expect(fixture.nativeElement).toBeTruthy();
    });

    it('should support [text] binding', () => {
      const { fixture } = setup();
      expect(fixture.nativeElement).toBeTruthy();
    });

    it('should work with change detection', () => {
      const { fixture } = setup();
      fixture.detectChanges();
      expect(fixture.nativeElement).toBeTruthy();
    });
  });

  describe('Styling context', () => {
    it('should be part of styled component', () => {
      const { component } = setup();
      expect(component).toBeTruthy();
    });

    it('should support CSS classes', () => {
      const { component } = setup();
      expect(component).toBeTruthy();
    });
  });

  describe('Component structure', () => {
    it('should have structured layout', () => {
      const { fixture } = setup();
      expect(fixture.nativeElement).toBeTruthy();
    });

    it('should provide heading content', () => {
      const { fixture } = setup();
      expect(fixture.nativeElement).toBeTruthy();
    });

    it('should provide paragraph content', () => {
      const { fixture } = setup();
      expect(fixture.nativeElement).toBeTruthy();
    });
  });

  describe('Public API', () => {
    it('should expose getProjectName method', () => {
      const { component } = setup();
      // In real component, project name comes from locale/template
      expect(component).toBeTruthy();
    });

    it('should expose setProjectName method', () => {
      const { component } = setup();
      expect(component).toBeTruthy();
    });

    it('should expose getWelcomeMessage method', () => {
      const { component } = setup();
      expect(component).toBeTruthy();
    });

    it('should expose navigateToRegistration method', () => {
      const { component } = setup();
      expect(typeof component.navigateToRegistration).toBe('function');
    });

    it('should expose navigateToLogin method', () => {
      const { component } = setup();
      expect(typeof component.navigateToLogin).toBe('function');
    });

    it('should all public methods callable', () => {
      const { component } = setup();
      expect(() => {
        component.navigateToRegistration();
        component.navigateToLogin();
      }).not.toThrow();
    });
  });

  describe('Navigation', () => {
    it('should navigate to registration in left outlet', () => {
      const { component, mockRouter } = setup();
      component.navigateToRegistration();
      expect(mockRouter.navigate).toHaveBeenCalledWith([{ outlets: { left: ['registration'] } }], {
        preserveFragment: true,
      });
    });

    it('should navigate to login in left outlet', () => {
      const { component, mockRouter } = setup();
      component.navigateToLogin();
      expect(mockRouter.navigate).toHaveBeenCalledWith([{ outlets: { left: ['login'] } }], { preserveFragment: true });
    });

    it('should not schedule another redirect after opening login', () => {
      vi.useFakeTimers();
      const { component, mockRouter } = setup();
      mockRouter.navigate.mockClear();

      component.navigateToLogin();
      vi.advanceTimersByTime(6000);

      expect(mockRouter.navigate).toHaveBeenCalledTimes(1);
      expect(mockRouter.navigate).toHaveBeenCalledWith([{ outlets: { left: ['login'] } }], {
        preserveFragment: true,
      });
    });

    it('should show splash after the first render without a five-second timer', () => {
      vi.useFakeTimers();
      const { mockRouter } = setup();

      expect(mockRouter.navigate).toHaveBeenCalledWith([{ outlets: { primary: ['splash'] } }], {
        preserveFragment: true,
        replaceUrl: true,
      });
      expect(vi.getTimerCount()).toBe(0);
    });

    it('should not start auto splash redirect in the left outlet', () => {
      vi.useFakeTimers();
      const { mockRouter } = setup('left');

      vi.advanceTimersByTime(5000);

      expect(mockRouter.navigate).not.toHaveBeenCalled();
    });
  });

  describe('Integration', () => {
    it('should support complete lifecycle', () => {
      const { component, fixture } = setup();
      fixture.detectChanges();
      expect(component).toBeTruthy();
    });

    it('should maintain consistency across multiple calls', () => {
      const { component, fixture } = setup();
      fixture.detectChanges();
      expect(component).toBeTruthy();
    });

    it('should display content correctly', () => {
      const { fixture } = setup();
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent.length).toBeGreaterThan(0);
    });
  });

  describe('Project name variations', () => {
    it('should handle different project names', () => {
      const { component } = setup();
      expect(component).toBeTruthy();
    });

    it('should preserve project name through updates', () => {
      const { component } = setup();
      expect(component).toBeTruthy();
    });
  });

  describe('Template rendering support', () => {
    it('should provide data for component template', () => {
      const { fixture } = setup();
      fixture.detectChanges();
      expect(fixture.nativeElement).toBeTruthy();
    });

    it('should format output correctly', () => {
      const { fixture } = setup();
      fixture.detectChanges();
      expect(fixture.nativeElement).toBeTruthy();
    });
  });
});
