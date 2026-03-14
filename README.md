## Starting schema

```sql
CREATE TABLE students (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE enrollments (
  id SERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL,
  year INTEGER NOT NULL,
  FOREIGN KEY (student_id) REFERENCES students(id)
);

INSERT INTO students (name)
SELECT
  'Student ' || n AS name
FROM generate_series(1, 100000) AS s(n);

INSERT INTO enrollments (student_id, year)
SELECT
  id AS student_id,
  (FLOOR(RANDOM() * (2025 - 1990 + 1)) + 1990)::INTEGER AS year
FROM
  students;
```

## Query performance


```sql
SELECT
  enrollments.year,
  COUNT(*)
FROM enrollments
  JOIN students ON enrollments.student_id = students.id
GROUP BY enrollments.year
ORDER BY enrollments.year;
```

Average execution duration over 5 queries: TODO



## Denormalization

```sql
ALTER TABLE students
ADD COLUMN enrollment_year INTEGER;

UPDATE students s
SET enrollment_year = sub.enrollment_year
FROM (
  SELECT
    student_id,
    MIN(year) AS enrollment_year
  FROM enrollments
  GROUP BY student_id
) AS sub
WHERE sub.student_id = s.id;
```


## Query and performance after denormalization

```sql
SELECT
  enrollment_year AS year,
  COUNT(*) AS student_count
FROM students
GROUP BY enrollment_year
ORDER BY enrollment_year;
```

Average execution duration over 5 queries: ~6.55 ms (EXPLAIN ANALYZE Execution Time)
