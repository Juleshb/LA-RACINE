import { useEffect, useMemo, useState } from 'react';
import { Download, FileSpreadsheet } from 'lucide-react';
import { api } from '../../lib/api';
import { useCampus } from '../../context/CampusContext';
import { useTranslation } from '../../context/LanguageContext';
import { downloadActivitiesCsv, downloadActivitiesWorkbook } from '../../lib/activitiesExport';

const EMPTY = { summary: { total: 0, boys: 0, girls: 0, joins: 0 }, byActivity: [], byClass: [] };

function genderWord(gender, t) {
  if (gender === 'MALE') return t('pageBody.activities.boy');
  if (gender === 'FEMALE') return t('pageBody.activities.girl');
  return '—';
}

export default function ActivitiesRoster({ version = 0 }) {
  const { t } = useTranslation();
  const { academicYear } = useCampus();
  const [roster, setRoster] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('activity');
  const [activityId, setActivityId] = useState('all');
  const [classId, setClassId] = useState('all');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.getExtracurricularRoster()
      .then((data) => {
        if (!cancelled) setRoster(data || EMPTY);
      })
      .catch(() => {
        if (!cancelled) setRoster(EMPTY);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [version]);

  const classOptions = useMemo(() => {
    const map = new Map();
    (roster.byClass || []).forEach((group) => {
      map.set(group.classId || 'unknown', group.className);
    });
    return [...map.entries()];
  }, [roster]);

  const filteredActivities = useMemo(() => (
    (roster.byActivity || [])
      .filter((activity) => activityId === 'all' || activity.id === activityId)
      .map((activity) => ({
        ...activity,
        classes: (activity.classes || []).filter((group) => classId === 'all' || (group.classId || 'unknown') === classId),
      }))
      .filter((activity) => activity.classes.length > 0)
      .map((activity) => {
        const students = activity.classes.flatMap((group) => group.students);
        const boys = students.filter((student) => student.gender === 'MALE').length;
        const girls = students.filter((student) => student.gender === 'FEMALE').length;
        return { ...activity, total: students.length, boys, girls };
      })
  ), [roster, activityId, classId]);

  const filteredClasses = useMemo(() => (
    (roster.byClass || [])
      .filter((group) => classId === 'all' || (group.classId || 'unknown') === classId)
      .map((group) => ({
        ...group,
        activities: (group.activities || []).filter((activity) => activityId === 'all' || activity.activityId === activityId),
      }))
      .filter((group) => group.activities.length > 0)
      .map((group) => {
        const students = group.activities.flatMap((activity) => activity.students);
        const unique = [...new Map(students.map((student) => [student.id, student])).values()];
        return {
          ...group,
          total: unique.length,
          boys: unique.filter((student) => student.gender === 'MALE').length,
          girls: unique.filter((student) => student.gender === 'FEMALE').length,
          joins: students.length,
        };
      })
  ), [roster, activityId, classId]);

  const visiblePeople = useMemo(() => {
    if (view === 'class') {
      return filteredClasses.flatMap((group) => group.activities.flatMap((activity) => activity.students));
    }
    return filteredActivities.flatMap((activity) => activity.classes.flatMap((group) => group.students));
  }, [view, filteredActivities, filteredClasses]);

  const visibleUnique = useMemo(() => {
    const unique = [...new Map(visiblePeople.map((person) => [person.id, person])).values()];
    return {
      total: unique.length,
      boys: unique.filter((person) => person.gender === 'MALE').length,
      girls: unique.filter((person) => person.gender === 'FEMALE').length,
      joins: visiblePeople.length,
    };
  }, [visiblePeople]);

  const labels = {
    title: t('pageBody.activities.rosterTitle'),
    sn: t('pageBody.activities.sn'),
    activity: t('pageBody.activities.activityLabel'),
    category: t('ui.category'),
    className: t('ui.class'),
    studentId: t('ui.studentId'),
    lastName: t('ui.lastName'),
    postName: t('ui.postName'),
    firstName: t('ui.firstName'),
    gender: t('ui.gender'),
    boy: t('pageBody.activities.boy'),
    girl: t('pageBody.activities.girl'),
    boys: t('pageBody.activities.boys'),
    girls: t('pageBody.activities.girls'),
    total: t('pageBody.activities.total'),
    summary: t('pageBody.activities.summary'),
    perActivity: t('pageBody.activities.perActivity'),
    perClass: t('pageBody.activities.perClass'),
    perActivityClass: t('pageBody.activities.perActivityClass'),
  };

  const exportPack = () => {
    const peopleByActivity = filteredActivities.flatMap((activity) => (
      activity.classes.flatMap((group) => group.students.map((person) => ({
        ...person,
        lead: [activity.name, activity.category || '', group.className],
      })))
    ));
    const peopleByClass = filteredClasses.flatMap((group) => (
      group.activities.flatMap((activity) => activity.students.map((person) => ({
        ...person,
        lead: [group.className, activity.name, activity.category || ''],
      })))
    ));
    return {
      peopleByActivity,
      peopleByClass,
      activitySummary: filteredActivities.map((activity) => [activity.name, activity.boys, activity.girls, activity.total]),
      classSummary: filteredClasses.map((group) => [group.className, group.boys, group.girls, group.total]),
      crossSummary: filteredActivities.flatMap((activity) => (
        activity.classes.map((group) => [activity.name, group.className, group.boys, group.girls, group.total])
      )),
    };
  };

  const exportExcel = () => {
    const pack = exportPack();
    downloadActivitiesWorkbook({
      ...pack,
      yearName: academicYear?.name || '',
      labels,
    });
  };

  const exportCsv = () => {
    downloadActivitiesCsv({ people: visiblePeople, labels });
  };

  return (
    <section className="card mb-6 overflow-hidden">
      <div className="p-4 border-b border-gray-100 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-gray-900">{t('pageBody.activities.rosterTitle')}</h2>
          <p className="text-sm text-gray-500 mt-0.5">{t('pageBody.activities.rosterHint')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-secondary text-sm flex items-center gap-1.5" onClick={exportExcel} disabled={!visiblePeople.length}>
            <FileSpreadsheet className="w-4 h-4" />
            {t('pageBody.activities.exportExcel')}
          </button>
          <button type="button" className="btn-secondary text-sm flex items-center gap-1.5" onClick={exportCsv} disabled={!visiblePeople.length}>
            <Download className="w-4 h-4" />
            {t('pageBody.activities.exportCsv')}
          </button>
        </div>
      </div>

      <div className="act-roster-stats">
        <div>
          <p className="act-roster-value">{visibleUnique.total}</p>
          <p className="act-roster-label">{t('pageBody.activities.people')}</p>
        </div>
        <div>
          <p className="act-roster-value">{visibleUnique.boys}</p>
          <p className="act-roster-label">{t('pageBody.activities.boys')}</p>
        </div>
        <div>
          <p className="act-roster-value">{visibleUnique.girls}</p>
          <p className="act-roster-label">{t('pageBody.activities.girls')}</p>
        </div>
        <div>
          <p className="act-roster-value">{visibleUnique.joins}</p>
          <p className="act-roster-label">{t('pageBody.activities.joins')}</p>
        </div>
      </div>

      <div className="act-roster-filters">
        <div>
          <label className="label">{t('pageBody.activities.viewBy')}</label>
          <select className="input" value={view} onChange={(e) => setView(e.target.value)}>
            <option value="activity">{t('pageBody.activities.perActivity')}</option>
            <option value="class">{t('pageBody.activities.perClass')}</option>
          </select>
        </div>
        <div>
          <label className="label">{t('pageBody.activities.activityLabel')}</label>
          <select className="input" value={activityId} onChange={(e) => setActivityId(e.target.value)}>
            <option value="all">{t('pageBody.activities.allActivities')}</option>
            {(roster.byActivity || []).filter((activity) => activity.total > 0).map((activity) => (
              <option key={activity.id} value={activity.id}>{activity.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">{t('ui.class')}</label>
          <select className="input" value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="all">{t('pageBody.activities.allClasses')}</option>
            {classOptions.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="p-4">
        {loading ? (
          <p className="text-sm text-gray-500">{t('ui.loading')}</p>
        ) : visiblePeople.length === 0 ? (
          <p className="text-sm text-gray-500">{t('pageBody.activities.noJoined')}</p>
        ) : view === 'activity' ? (
          <div className="space-y-4">
            {filteredActivities.map((activity) => (
              <article key={activity.id} className="act-roster-block">
                <header className="act-roster-head">
                  <div>
                    <h3>{activity.name}</h3>
                    <p>{[activity.category, activity.schedule, activity.instructor].filter(Boolean).join(' · ')}</p>
                  </div>
                  <span>{t('staffDash.genderSplit', { boys: activity.boys, girls: activity.girls })}</span>
                </header>
                {activity.classes.map((group) => (
                  <div key={group.classId || group.className}>
                    <div className="act-roster-sub">
                      <strong>{group.className}</strong>
                      <span>{t('staffDash.genderSplit', { boys: group.boys, girls: group.girls })}</span>
                    </div>
                    <PeopleTable people={group.students} t={t} />
                  </div>
                ))}
              </article>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredClasses.map((group) => (
              <article key={group.classId || group.className} className="act-roster-block">
                <header className="act-roster-head">
                  <div>
                    <h3>{group.className}</h3>
                    <p>{t('pageBody.activities.joins')}: {group.joins}</p>
                  </div>
                  <span>{t('staffDash.genderSplit', { boys: group.boys, girls: group.girls })}</span>
                </header>
                {group.activities.map((activity) => (
                  <div key={activity.activityId}>
                    <div className="act-roster-sub">
                      <strong>{activity.name}</strong>
                      <span>{t('staffDash.genderSplit', { boys: activity.boys, girls: activity.girls })}</span>
                    </div>
                    <PeopleTable people={activity.students} t={t} />
                  </div>
                ))}
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function PeopleTable({ people, t }) {
  return (
    <table className="act-roster-table">
      <thead>
        <tr>
          <th>{t('pageBody.activities.sn')}</th>
          <th>{t('ui.studentId')}</th>
          <th>{t('ui.name')}</th>
          <th>{t('ui.gender')}</th>
        </tr>
      </thead>
      <tbody>
        {people.map((person, index) => (
          <tr key={person.enrollmentId || `${person.id}-${index}`}>
            <td>{index + 1}</td>
            <td>{person.studentId || '—'}</td>
            <td>{person.name}</td>
            <td>
              <span className={`act-roster-gender ${person.gender === 'FEMALE' ? 'is-girl' : 'is-boy'}`}>
                {genderWord(person.gender, t)}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
