import { Link } from 'react-router-dom';
import StudentRegistration from '../StudentRegistration';

/** Public online admission — no login required. */
export default function PublicOnlineRegistration() {
  return (
    <>
      <div className="ps-page-hero">
        <div className="ps-page-hero-inner">
          <p className="ps-section-label">Admissions</p>
          <h1>Apply online</h1>
          <p>
            Submit your child’s admission application without creating an account.
            The school will review it and contact you.
          </p>
          <p style={{ marginTop: '0.75rem' }}>
            <Link to="/admissions" className="ps-btn ps-btn-ghost">Back to admissions</Link>
          </p>
        </div>
      </div>

      <section className="ps-section">
        <div className="ps-container" style={{ maxWidth: '56rem', margin: '0 auto' }}>
          <StudentRegistration isPublic />
        </div>
      </section>
    </>
  );
}
