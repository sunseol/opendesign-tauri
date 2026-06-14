import type { LandingLocaleCode } from '../i18n';
import { getHomeNewsletterCopy } from '../home-newsletter-copy';

export function HomeNewsletterSection({
  locale,
}: {
  readonly locale: LandingLocaleCode;
}) {
  const newsletter = getHomeNewsletterCopy(locale);

  return (
    <section className='newsletter' id='newsletter' data-od-id='newsletter'>
      <div className='container'>
        <div className='newsletter-grid'>
          <div className='newsletter-copy' data-reveal>
            <h2 className='newsletter-title'>{newsletter.title}</h2>
            <p className='newsletter-desc'>{newsletter.description}</p>
          </div>
          <form
            className='newsletter-form'
            data-newsletter
            data-newsletter-done={newsletter.done}
            data-newsletter-error={newsletter.error}
            data-reveal='right'
          >
            <input
              className='newsletter-input'
              type='email'
              name='email'
              placeholder={newsletter.placeholder}
              autoComplete='email'
              required
              aria-label={newsletter.title}
            />
            <button className='newsletter-submit' type='submit'>
              {newsletter.button}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
