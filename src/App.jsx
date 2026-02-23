import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import resultFile from '../result.xlsx?url';

function useResults() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(resultFile);
        const buf = await res.arrayBuffer();
        const workbook = XLSX.read(buf, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        setRows(json);
      } catch (e) {
        console.error(e);
        setError('Failed to load results file.');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  return { rows, loading, error };
}

function detectTextFields(rows) {
  if (!rows.length) return [];
  const sample = rows[0];
  return Object.keys(sample).filter((key) => {
    const value = sample[key];
    return typeof value === 'string' && value.trim() !== '';
  });
}

function detectNumericFields(rows) {
  if (!rows.length) return [];
  const sample = rows[0];
  return Object.keys(sample).filter((key) => {
    const value = sample[key];
    const num = typeof value === 'number' ? value : parseFloat(value);
    return Number.isFinite(num);
  });
}

function extractSubjectFields(rows, textFields = []) {
  if (!rows.length) return [];
  const keys = Object.keys(rows[0]);
  const textSet = new Set(textFields.map((k) => k.toLowerCase()));

  return keys
    .map((key) => {
      const lower = key.toLowerCase();

      // Skip obvious non-subject columns and text-like fields
      if (
        textSet.has(lower) ||
        /(roll|reg|registration|enrol|enrollment|id)/.test(lower) ||
        /(total|aggregate|overall|gpa|cgpa|sgpa|percentage|percent|score)/.test(
          lower,
        )
      ) {
        return null;
      }

      // Require column to be numeric wherever it has values
      let hasNumeric = false;
      for (const row of rows) {
        const raw = row[key];
        if (raw === '' || raw == null) continue;
        const num = typeof raw === 'number' ? raw : parseFloat(raw);
        if (!Number.isFinite(num)) {
          return null;
        }
        hasNumeric = true;
      }

      if (!hasNumeric) return null;

      let credit = null;
      const parenMatch = key.match(/\((\d+(\.\d+)?)\)/);
      if (parenMatch) {
        credit = parseFloat(parenMatch[1]);
      } else {
        const trailingMatch = key.match(/(\d+(\.\d+)?)\s*$/);
        if (trailingMatch) {
          credit = parseFloat(trailingMatch[1]);
        }
      }

      return { key, label: prettyKey(key), credit };
    })
    .filter(Boolean);
}

function buildHistogramData(rows, field, bins = 8) {
  if (!rows.length || !field) return [];

  const values = rows
    .map((row) => {
      const raw = row[field];
      const num = typeof raw === 'number' ? raw : parseFloat(raw);
      return Number.isFinite(num) ? num : null;
    })
    .filter((v) => v !== null);

  if (!values.length) return [];

  const min = Math.min(...values);
  const max = Math.max(...values);
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) {
    return [];
  }

  const step = (max - min) / bins;
  const data = Array.from({ length: bins }, (_, i) => {
    const start = min + i * step;
    const end = i === bins - 1 ? max : min + (i + 1) * step;
    return {
      range: `${Math.round(start)} – ${Math.round(end)}`,
      count: 0,
    };
  });

  values.forEach((v) => {
    let idx = Math.floor(((v - min) / (max - min)) * bins);
    if (idx >= bins) idx = bins - 1;
    if (idx < 0) idx = 0;
    data[idx].count += 1;
  });

  return data;
}

function buildGpaCountData(rows, metrics) {
  if (!rows.length || !metrics.length) return [];

  const bins = new Map();

  metrics.forEach((metricKey) => {
    rows.forEach((row) => {
      const raw = row[metricKey];
      const num = typeof raw === 'number' ? raw : parseFloat(raw);
      if (!Number.isFinite(num)) return;

      const rounded = Number(num.toFixed(2));
      const binKey = `${rounded}`;
      let bin = bins.get(binKey);
      if (!bin) {
        bin = { gpa: rounded };
        bins.set(binKey, bin);
      }
      bin[metricKey] = (bin[metricKey] || 0) + 1;
    });
  });

  return Array.from(bins.values()).sort((a, b) => a.gpa - b.gpa);
}

function prettyKey(key) {
  return String(key)
    .replaceAll('_', ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function metricLabel(key) {
  const lower = String(key).toLowerCase();
  if (lower === 'cg' || lower === 'cgpa' || lower.includes(' cg') || lower.includes('cgpa')) {
    return 'CGPA';
  }
  return prettyKey(key);
}

function App() {
  const { rows, loading, error } = useResults();
  const [search, setSearch] = useState('');
  const [selectedRow, setSelectedRow] = useState(null);
  const [activeMetricKeys, setActiveMetricKeys] = useState([]);
  const [onlyWithMetric, setOnlyWithMetric] = useState(false);
  const detailRef = useRef(null);

  const textFields = useMemo(() => detectTextFields(rows), [rows]);
  const numericFields = useMemo(() => detectNumericFields(rows), [rows]);
  const subjectFields = useMemo(
    () => extractSubjectFields(rows, textFields),
    [rows, textFields],
  );

  const primaryTextField = useMemo(() => {
    const joined = textFields.join(' ').toLowerCase();
    const candidates = ['name', 'student', 'candidate'];
    const found = candidates.find((c) => joined.includes(c));
    if (!found) return textFields[0] || null;
    return textFields.find((f) => f.toLowerCase().includes(found)) || textFields[0] || null;
  }, [textFields]);

  const idField = useMemo(() => {
    const sample = rows[0];
    const keys = sample ? Object.keys(sample) : [];
    const candidates = ['roll', 'reg', 'registration', 'enrol', 'enrollment', 'admission', 'id'];

    // Prefer text fields if possible
    const orderedKeys = [
      ...textFields,
      ...keys.filter((k) => !textFields.includes(k)),
    ];

    const lowerKeys = orderedKeys.map((k) => k.toLowerCase());
    const matchedCandidate = candidates.find((cand) =>
      lowerKeys.some((k) => k.includes(cand)),
    );
    if (!matchedCandidate) return null;

    return (
      orderedKeys.find((k) =>
        k.toLowerCase().includes(matchedCandidate),
      ) || null
    );
  }, [rows, textFields]);

  const primaryNumericField = useMemo(() => {
    if (!numericFields.length) return null;
    const preferred = [
      'cg',
      'cgpa',
      'gpa',
      'total',
      'aggregate',
      'overall',
      'sgpa',
      'percentage',
      'percent',
      'score',
    ];
    const lower = numericFields.map((f) => f.toLowerCase());
    const idx = lower.findIndex((f) => preferred.some((p) => f.includes(p)));
    if (idx >= 0) return numericFields[idx];

    if (subjectFields.length) {
      return subjectFields[0].key;
    }

    return numericFields[0];
  }, [numericFields, subjectFields]);

  const defaultMetricKey = useMemo(
    () => primaryNumericField || subjectFields[0]?.key || null,
    [primaryNumericField, subjectFields],
  );

  const chartMetricKeys = useMemo(
    () =>
      activeMetricKeys.length
        ? activeMetricKeys
        : defaultMetricKey
          ? [defaultMetricKey]
          : [],
    [activeMetricKeys, defaultMetricKey],
  );

  const filterMetricKey = useMemo(
    () => chartMetricKeys[0] || null,
    [chartMetricKeys],
  );

  const metricOptions = useMemo(() => {
    const options = [];
    const seen = new Set();

    const isIdLike = (key) => {
      const lower = String(key).toLowerCase();
      return /(roll|reg|registration|enrol|enrollment|id)/.test(lower);
    };

    if (primaryNumericField && !isIdLike(primaryNumericField)) {
      options.push({
        key: primaryNumericField,
        label: metricLabel(primaryNumericField),
      });
      seen.add(primaryNumericField);
    }

    subjectFields.forEach((s) => {
      if (!seen.has(s.key) && !isIdLike(s.key)) {
        options.push({ key: s.key, label: s.label });
        seen.add(s.key);
      }
    });

    return options;
  }, [primaryNumericField, subjectFields]);

  const filteredRows = useMemo(() => {
    let baseRows = rows;

    if (onlyWithMetric && filterMetricKey) {
      baseRows = baseRows.filter((row) => {
        const raw = row[filterMetricKey];
        if (raw === '' || raw == null) return false;
        const num = typeof raw === 'number' ? raw : parseFloat(raw);
        return Number.isFinite(num);
      });
    }

    if (!search.trim()) return baseRows;
    const q = search.toLowerCase();
    return baseRows.filter((row) =>
      Object.values(row).some((value) =>
        String(value).toLowerCase().includes(q),
      ),
    );
  }, [rows, search, onlyWithMetric, filterMetricKey]);

  const chartData = useMemo(
    () => buildGpaCountData(filteredRows, chartMetricKeys),
    [filteredRows, chartMetricKeys],
  );

  const summary = useMemo(() => {
    const totalStudents = rows.length;
    if (!totalStudents || !primaryNumericField) {
      return { totalStudents, avgScore: null, maxScore: null, minScore: null };
    }

    const numericValues = rows
      .map((row) => {
        const raw = row[primaryNumericField];
        const num = typeof raw === 'number' ? raw : parseFloat(raw);
        return Number.isFinite(num) ? num : null;
      })
      .filter((v) => v !== null);

    if (!numericValues.length) {
      return { totalStudents, avgScore: null, maxScore: null, minScore: null };
    }

    const sum = numericValues.reduce((acc, v) => acc + v, 0);
    const avgScore = sum / numericValues.length;
    const maxScore = Math.max(...numericValues);
    const minScore = Math.min(...numericValues);

    return { totalStudents, avgScore, maxScore, minScore };
  }, [rows, primaryNumericField]);

  const subjectMaxMap = useMemo(() => {
    const map = {};
    subjectFields.forEach((subject) => {
      let max = 0;
      rows.forEach((row) => {
        const raw = row[subject.key];
        const num = typeof raw === 'number' ? raw : parseFloat(raw);
        if (Number.isFinite(num) && num > max) {
          max = num;
        }
      });
      if (max > 0) {
        map[subject.key] = max;
      }
    });
    return map;
  }, [rows, subjectFields]);

  const studentOverviewData = useMemo(() => {
    if (!selectedRow || !subjectFields.length) return [];

    return subjectFields
      .map((subject) => {
        const raw = selectedRow[subject.key];
        const num = typeof raw === 'number' ? raw : parseFloat(raw);
        if (!Number.isFinite(num)) return null;
        return {
          subject: subject.label,
          score: num,
        };
      })
      .filter(Boolean);
  }, [selectedRow, subjectFields]);

  useEffect(() => {
    if (!rows.length || selectedRow) return;

    const targetReg = '2024331082';
    let initial = null;

    if (idField) {
      initial = rows.find(
        (row) =>
          row[idField] != null &&
          String(row[idField]).trim().toLowerCase() === targetReg.toLowerCase(),
      );
    }

    setSelectedRow(initial || rows[0]);
  }, [rows, selectedRow, idField]);

  const handleRowClick = (row) => {
    setSelectedRow(row);
    if (detailRef.current) {
      detailRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }
  };

  const handleSearchResultClick = (row) => {
    handleRowClick(row);
    setSearch('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-50">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
        {/* Header Section */}
        <header className="mb-8 space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2.5 rounded-full border border-emerald-500/30 bg-emerald-500/5 px-4 py-1.5 text-[11px] font-semibold tracking-wide text-emerald-300 backdrop-blur-md shadow-[0_0_20px_rgba(16,185,129,0.15)]">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                </span>
                SUST • CSE DEPARTMENT
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
                Result <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-sky-400">Portal</span>
              </h1>
              <p className="max-w-2xl text-sm leading-relaxed text-slate-400">
                Detailed academic performance overview for the 1st Year, 1st Semester.
                Explore individual grades, subject-wise breakdowns, and class-wise analytics.
              </p>
            </div>

            <div className="flex flex-wrap gap-4">
              <div className="glass-panel px-5 py-3 !rounded-2xl flex flex-col items-center justify-center min-w-[120px]">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Total Students</span>
                <span className="text-2xl font-black text-white">{summary.totalStudents || 0}</span>
              </div>
              {summary.avgScore && (
                <div className="glass-panel px-5 py-3 !rounded-2xl flex flex-col items-center justify-center min-w-[120px] bg-emerald-500/5 border-emerald-500/20">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-500/70">Class Average</span>
                  <span className="text-2xl font-black text-emerald-400">{summary.avgScore.toFixed(2)}</span>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="grid flex-1 gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          {/* Left: search + details + table */}
          <section className="space-y-4">
            <div className="glass-panel relative overflow-hidden p-4 sm:p-5">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.12),transparent_55%),radial-gradient(circle_at_bottom,_rgba(16,185,129,0.18),transparent_55%)]" />
              <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <label className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                      Search Students
                    </label>
                  </div>
                  <div className="mt-1 flex items-center gap-2 rounded-2xl border border-slate-700/70 bg-slate-900/80 px-3 py-2 text-sm shadow-[0_18px_55px_rgba(15,23,42,0.9)] focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/40">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      className="h-4 w-4 flex-shrink-0 text-slate-400"
                      aria-hidden="true"
                    >
                      <path
                        d="M15.5 15.5 20 20"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                      />
                      <circle
                        cx="11"
                        cy="11"
                        r="5.5"
                        stroke="currentColor"
                        strokeWidth="1.6"
                      />
                    </svg>
                    <input
                      type="text"
                      placeholder="Search by name or Registration no..."
                      className="w-full bg-transparent text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                    {search && (
                      <button
                        type="button"
                        onClick={() => setSearch('')}
                        className="rounded-full bg-slate-800 px-2 py-1 text-[10px] font-medium text-slate-300 hover:bg-slate-700"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <p className="mt-1.5 text-[11px] text-slate-400">
                    Showing{' '}
                    <span className="font-semibold text-slate-200">
                      {filteredRows.length}
                    </span>{' '}
                    matching record{filteredRows.length === 1 ? '' : 's'}. Click a row to view details.
                  </p>
                  {search.trim() && filteredRows.length > 0 && (
                    <div className="mt-2 max-h-48 overflow-y-auto rounded-2xl border border-slate-800/80 bg-slate-950/90 p-1 text-xs text-slate-200 shadow-[0_18px_45px_rgba(15,23,42,0.9)] scrollbar-soft">
                      {filteredRows.slice(0, 6).map((row, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSearchResultClick(row)}
                          className="flex w-full items-center justify-between gap-3 rounded-xl px-2 py-1.5 text-left hover:bg-slate-900/80"
                        >
                          <div className="flex flex-col">
                            <span className="text-[11px] font-medium text-slate-100">
                              {primaryTextField ? row[primaryTextField] || 'Unknown' : 'Result'}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {primaryNumericField && row[primaryNumericField] != null
                                ? `${prettyKey(primaryNumericField)}: ${row[primaryNumericField]}`
                                : 'Tap to open full result'}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div ref={detailRef} className="glass-panel p-4 sm:p-5 relative overflow-hidden">
              <div className="pointer-events-none absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
              <div className="flex flex-wrap items-center justify-between gap-4 relative">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <svg className="w-5 h-5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Student Academic Profile
                  </h2>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Comprehensive breakdown of individual results and subject performance.
                  </p>
                </div>
                {selectedRow && (
                  <div className="pill">
                    <span className="pill-dot" />
                    <span className="text-[10px] uppercase tracking-[0.16em] text-slate-200">
                      Selected
                    </span>
                  </div>
                )}
              </div>

              {!selectedRow ? (
                <p className="mt-4 text-xs text-slate-400">
                  Select a row from the result list below to see full details.
                </p>
              ) : (
                <div className="mt-4 space-y-4">
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
                    <div className="space-y-2 text-xs text-slate-200">
                      {primaryTextField && (
                        <div className="flex justify-between gap-3 rounded-xl bg-slate-900/80 px-3 py-2">
                          <span className="text-[11px] font-medium text-slate-400">
                            {prettyKey(primaryTextField)}
                          </span>
                          <span className="max-w-[60%] text-right text-xs text-slate-100">
                            {String(selectedRow[primaryTextField] || '—')}
                          </span>
                        </div>
                      )}
                      {idField && idField !== primaryTextField && (
                        <div className="flex justify-between gap-3 rounded-xl bg-slate-900/80 px-3 py-2">
                          <span className="text-[11px] font-medium text-slate-400">
                            {prettyKey(idField)}
                          </span>
                          <span className="max-w-[60%] text-right text-xs text-slate-100">
                            {String(selectedRow[idField] || '—')}
                          </span>
                        </div>
                      )}
                      {Object.entries(selectedRow)
                        .filter(
                          ([key]) =>
                            key !== idField &&
                            key !== primaryTextField &&
                            key !== primaryNumericField &&
                            !subjectFields.some((s) => s.key === key),
                        )
                        .slice(0, 4)
                        .map(([key, value]) => (
                          <div
                            key={key}
                            className="flex justify-between gap-3 rounded-xl bg-slate-900/80 px-3 py-2"
                          >
                            <span className="text-[11px] font-medium text-slate-400">
                              {prettyKey(key)}
                            </span>
                            <span className="max-w-[60%] text-right text-xs text-slate-100">
                              {String(value || '—')}
                            </span>
                          </div>
                        ))}
                    </div>

                    <div className="flex flex-col gap-3 rounded-2xl bg-slate-950/70 p-3 text-xs text-slate-300">
                      {primaryNumericField && (
                        <>
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-medium text-slate-400">
                              {metricLabel(primaryNumericField)}
                            </span>
                            <span className="text-sm font-semibold text-emerald-400">
                              {selectedRow[primaryNumericField] ?? '—'}
                            </span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-sky-400 to-blue-500"
                              style={{
                                width:
                                  summary.maxScore && selectedRow[primaryNumericField] != null
                                    ? `${Math.max(
                                      8,
                                      Math.min(
                                        100,
                                        (Number(selectedRow[primaryNumericField]) /
                                          summary.maxScore) *
                                        100,
                                      ),
                                    )}%`
                                    : '40%',
                              }}
                            />
                          </div>
                        </>
                      )}
                      {/* <div className="mt-1">
                        <p className="text-[11px] text-slate-400">
                          Quickly compare this record with others using the search above and the distribution chart on the right.
                        </p>
                      </div> */}
                    </div>
                  </div>

                  {subjectFields.length > 0 && (
                    <div className="rounded-2xl bg-slate-900/80 p-3 text-xs text-slate-200">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">
                          Subject-wise performance
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {subjectFields.length} subject
                          {subjectFields.length === 1 ? '' : 's'}
                        </span>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {subjectFields.map((subject) => {
                          const raw = selectedRow[subject.key];
                          if (raw === '' || raw == null) return null;
                          const num =
                            typeof raw === 'number' ? raw : parseFloat(raw);
                          const isNumeric = Number.isFinite(num);
                          const mark = isNumeric ? num : raw;
                          const maxForSubject = subjectMaxMap[subject.key];
                          const normalized =
                            isNumeric && maxForSubject
                              ? Math.max(0, Math.min(1, num / maxForSubject))
                              : 0.75;

                          return (
                            <div
                              key={subject.key}
                              className="rounded-xl bg-slate-950/80 px-3 py-2.5"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex flex-col">
                                  <span className="text-[11px] font-medium text-slate-200">
                                    {subject.label}
                                  </span>
                                  {subject.credit != null && (
                                    <span className="text-[10px] text-slate-400">
                                      {subject.credit} credit
                                      {subject.credit === 1 ? '' : 's'}
                                    </span>
                                  )}
                                </div>
                                <span className="text-sm font-semibold text-emerald-400">
                                  {mark}
                                </span>
                              </div>
                              {isNumeric && (
                                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                                  <div
                                    className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-sky-400 to-blue-500"
                                    style={{
                                      width: `${Math.max(
                                        6,
                                        normalized * 100,
                                      )}%`,
                                    }}
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="glass-panel flex min-h-[300px] flex-col overflow-hidden">
              <div className="flex items-center justify-between border-b border-white/5 px-4 py-3 bg-white/5">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                    </svg>
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-widest text-slate-300">Registration Index</span>
                </div>
                <div className="text-[10px] text-slate-500 font-medium bg-slate-800/50 px-2 py-0.5 rounded-full">
                  Sorted by Entry
                </div>
              </div>
              <div className="flex-1 overflow-auto">
                {loading ? (
                  <div className="flex h-full items-center justify-center px-4 py-10 text-sm text-slate-400">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-2 w-2 animate-ping rounded-full bg-emerald-400" />
                      Loading results from Excel&hellip;
                    </div>
                  </div>
                ) : error ? (
                  <div className="flex h-full items-center justify-center px-4 py-10 text-sm text-rose-300">
                    {error}
                  </div>
                ) : !rows.length ? (
                  <div className="flex h-full items-center justify-center px-4 py-10 text-sm text-slate-400">
                    No rows found in the first sheet of <span className="ml-1 font-mono text-slate-200">result.xlsx</span>.
                    Make sure the first row contains headers.
                  </div>
                ) : (
                  <table className="min-w-full border-separate border-spacing-0 text-left text-xs">
                    <thead className="sticky top-0 z-10 bg-slate-950/90 backdrop-blur">
                      <tr>
                        {primaryTextField && primaryTextField !== idField && (
                          <th className="border-b border-slate-800 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                            {prettyKey(primaryTextField)}
                          </th>
                        )}
                        {idField && (
                          <th className="border-b border-slate-800 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 text-right">
                            {prettyKey(idField)}
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRows.map((row, idx) => {
                        const isActive = selectedRow === row;
                        return (
                          <tr
                            key={idx}
                            onClick={() => handleRowClick(row)}
                            className={`cursor-pointer align-middle transition-colors ${isActive
                              ? 'bg-emerald-500/10 hover:bg-emerald-500/15'
                              : idx % 2 === 0
                                ? 'hover:bg-slate-900/70'
                                : 'hover:bg-slate-900/80'
                              }`}
                          >
                            {primaryTextField && primaryTextField !== idField && (
                              <td className="max-w-[180px] px-4 py-2 text-xs text-slate-200">
                                <div className="truncate" title={String(row[primaryTextField] ?? '')}>
                                  {row[primaryTextField] ?? '—'}
                                </div>
                              </td>
                            )}
                            {idField && (
                              <td className="whitespace-nowrap px-4 py-2 text-right text-xs text-slate-100">
                                {row[idField] ?? '—'}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </section>

          {/* Right: analytics & chart */}
          <section className="space-y-4">
            <div className="glass-panel flex min-h-[220px] flex-col p-4 sm:p-5 relative overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-4 relative">
                <div>
                  <h2 className="text-sm font-bold text-white flex items-center gap-2">
                    <svg className="w-4 h-4 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    Performance Visualization
                  </h2>
                  <p className="mt-0.5 text-[10px] text-slate-500 font-medium">
                    Relative subject weights and achieved scores.
                  </p>
                </div>
                {selectedRow && (
                  <div className="px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 text-[10px] font-bold text-sky-400 backdrop-blur-sm">
                    {primaryTextField && selectedRow[primaryTextField]
                      ? String(selectedRow[primaryTextField])
                      : 'Active Record'}
                  </div>
                )}
              </div>

              <div className="mt-4">
                {!selectedRow || !studentOverviewData.length ? (
                  <div className="flex h-full items-center justify-center text-xs text-slate-400">
                    Select a student from the list to see their subject-wise chart.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={studentOverviewData}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#1f2937"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="subject"
                        stroke="#9ca3af"
                        tick={{ fontSize: 10 }}
                        tickLine={false}
                        axisLine={{ stroke: '#374151' }}
                      />
                      <YAxis
                        stroke="#9ca3af"
                        tick={{ fontSize: 10 }}
                        tickLine={false}
                        axisLine={{ stroke: '#374151' }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#020617',
                          borderRadius: 12,
                          border: '1px solid rgba(30,64,175,0.75)',
                          fontSize: 11,
                        }}
                        labelStyle={{ color: '#e5e7eb', marginBottom: 4 }}
                        cursor={{ fill: 'rgba(37,99,235,0.08)' }}
                      />
                      <Bar
                        dataKey="score"
                        name="Score"
                        radius={[6, 6, 2, 2]}
                        fill="url(#studentOverviewGradient)"
                        isAnimationActive
                        animationDuration={800}
                        animationEasing="ease-out"
                      />
                      <defs>
                        <linearGradient
                          id="studentOverviewGradient"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.95" />
                          <stop offset="60%" stopColor="#22c55e" stopOpacity="0.9" />
                          <stop offset="100%" stopColor="#a855f7" stopOpacity="0.85" />
                        </linearGradient>
                      </defs>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="glass-panel flex min-h-[260px] flex-col p-4 sm:p-5 relative overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-4 relative">
                <div>
                  <h2 className="text-sm font-bold text-white flex items-center gap-2">
                    <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                    </svg>
                    Class Analytics
                  </h2>
                  <p className="mt-0.5 text-[10px] text-slate-500 font-medium">
                    GPA distribution across the entire batch.
                  </p>
                </div>
                {metricOptions.length > 0 && (
                  <div className="flex items-center gap-2 text-[11px] text-slate-400">
                    <span className="hidden sm:inline">Metric:</span>
                    <div className="scrollbar-soft flex max-w-xs gap-1 overflow-x-auto rounded-full bg-slate-900/80 px-1 py-1">
                      {metricOptions.map((opt) => (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() =>
                            setActiveMetricKeys((current) =>
                              current.includes(opt.key)
                                ? current.filter((k) => k !== opt.key)
                                : [...current, opt.key],
                            )
                          }
                          className={`whitespace-nowrap rounded-full px-2 py-1 text-[10px] font-medium transition ${chartMetricKeys.includes(opt.key)
                            ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/60'
                            : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700/80'
                            }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-slate-400">
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)]" />
                  <span>
                    {summary.totalStudents || 0} records included in this view.
                  </span>
                </div>
                <label className="flex cursor-pointer items-center gap-2 rounded-full bg-slate-900/80 px-2 py-1">
                  <input
                    type="checkbox"
                    className="h-3 w-3 rounded border-slate-600 bg-slate-900 text-emerald-500 focus:outline-none focus:ring-0"
                    checked={onlyWithMetric}
                    onChange={(e) => setOnlyWithMetric(e.target.checked)}
                  />
                  <span>Filter list by this metric</span>
                </label>
              </div>

              <div className="mt-4">
                {!chartData.length ? (
                  <div className="flex h-full items-center justify-center text-xs text-slate-400">
                    No numeric field detected to plot. Ensure at least one column in Excel
                    contains numeric scores.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={chartData}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#1f2937"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="gpa"
                        stroke="#9ca3af"
                        tick={{ fontSize: 10 }}
                        tickLine={false}
                        axisLine={{ stroke: '#374151' }}
                      />
                      <YAxis
                        allowDecimals={false}
                        stroke="#9ca3af"
                        tick={{ fontSize: 10 }}
                        tickLine={false}
                        axisLine={{ stroke: '#374151' }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#020617',
                          borderRadius: 12,
                          border: '1px solid rgba(30,64,175,0.75)',
                          fontSize: 11,
                        }}
                        labelStyle={{ color: '#e5e7eb', marginBottom: 4 }}
                        cursor={{ fill: 'rgba(37,99,235,0.08)' }}
                      />
                      <Legend
                        formatter={(value) => (
                          <span className="text-[11px] text-slate-300">{value}</span>
                        )}
                      />
                      {chartMetricKeys.map((key, index) => {
                        const colorPalette = [
                          '#22c55e',
                          '#0ea5e9',
                          '#a855f7',
                          '#f59e0b',
                          '#ef4444',
                        ];
                        const color = colorPalette[index % colorPalette.length];
                        return (
                          <Bar
                            key={key}
                            dataKey={key}
                            name={metricLabel(key)}
                            radius={[6, 6, 2, 2]}
                            fill={color}
                            isAnimationActive
                            animationDuration={900}
                            animationEasing="ease-out"
                          />
                        );
                      })}
                      <defs>
                        <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#22c55e" stopOpacity="0.95" />
                          <stop offset="60%" stopColor="#0ea5e9" stopOpacity="0.9" />
                          <stop offset="100%" stopColor="#1d4ed8" stopOpacity="0.85" />
                        </linearGradient>
                      </defs>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

export default App;

