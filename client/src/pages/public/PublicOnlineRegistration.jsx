import { Link } from 'react-router-dom';
import StudentRegistration from '../StudentRegistration';
import PageHero from '../../components/public/PageHero';
import { usePublicSite } from '../../hooks/usePublicSite';

/** Public online admission — no login required. */
export default function PublicOnlineRegistration() {
  const { page } = usePublicSite();
  const admissions = page('admissions') || {};

  return (
    <>
      <PageHero
        label={admissions.label || 'Admissions'}
        title="Apply online"
        lead="Submit your child’s admission application without creating an account. The school will review it and contact you."
        imageUrl={admissions.heroImageUrl}
      />
      <div className="ps-section" style={{ paddingTop: 0 }}>
        <div className="ps-container" style={{ maxWidth: '56rem', margin: '0 auto' }}>
          <p style={{ marginBottom: '1rem' }}>
            <Link to="/admissions" className="ps-btn ps-btn-ghost">Back to admissions</Link>
          </p>
          <StudentRegistration isPublic />
        </div>
      </div>
    </>
  );
}
