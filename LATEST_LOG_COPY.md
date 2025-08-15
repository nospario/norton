# This is a copy of the log from the container the app has been running in which shows the errors occurring which relate to some of the issues in the BUGS.md file

2025-08-15 16:38:57


    '                r.first_name,\n' +
2025-08-15 16:38:57


    '                r.last_name,\n' +
2025-08-15 16:38:57


    '                r.monthly_support_hours,\n' +
2025-08-15 16:38:57


    '                p.name as property_name,\n' +
2025-08-15 16:38:57


    '                COALESCE(SUM(s.duration_minutes), 0) / 60.0 as hours_used,\n' +
2025-08-15 16:38:57


    '                r.monthly_support_hours - COALESCE(SUM(s.duration_minutes), 0) / 60.0 as remaining_hours\n' +
2025-08-15 16:38:57


    '            FROM residents r\n' +
2025-08-15 16:38:57


    '            LEFT JOIN properties p ON r.property_id = p.id\n' +
2025-08-15 16:38:57


    '            LEFT JOIN support_sessions s ON r.id = s.resident_id \n' +
2025-08-15 16:38:57


    '                AND EXTRACT(YEAR FROM s.session_date) = $1\n' +
2025-08-15 16:38:57


    '                AND EXTRACT(MONTH FROM s.session_date) = $2\n' +
2025-08-15 16:38:57


    "                AND s.status = 'completed'\n" +
2025-08-15 16:38:57


    '            WHERE r.is_active = true\n' +
2025-08-15 16:38:57


    '            GROUP BY r.id, r.first_name, r.last_name, r.monthly_support_hours, p.name\n' +
2025-08-15 16:38:57


    '            ORDER BY r.last_name, r.first_name\n' +
2025-08-15 16:38:57


    '        ',
2025-08-15 16:38:57


  duration: 13,
2025-08-15 16:38:57


  rows: 15
2025-08-15 16:38:57


}
2025-08-15 16:38:57


executed query {
2025-08-15 16:38:57


  text: 'SELECT s.*, \n' +
2025-08-15 16:38:57


    '                    r.first_name as resident_first_name, r.last_name as resident_last_name,\n' +
2025-08-15 16:38:57


    '                    sw.first_name as worker_first_name, sw.last_name as worker_last_name,\n' +
2025-08-15 16:38:57


    '                    p.name as property_name\n' +
2025-08-15 16:38:57


    '             FROM support_sessions s\n' +
2025-08-15 16:38:57


    '             JOIN residents r ON s.resident_id = r.id\n' +
2025-08-15 16:38:57


    '             JOIN support_workers sw ON s.support_worker_id = sw.id\n' +
2025-08-15 16:38:57


    '             JOIN properties p ON s.property_id = p.id\n' +
2025-08-15 16:38:57


    '             WHERE s.session_date BETWEEN $1 AND $2\n' +
2025-08-15 16:38:57


    '             ORDER BY s.session_date, s.start_time',
2025-08-15 16:38:57


  duration: 2,
2025-08-15 16:38:57


  rows: 1
2025-08-15 16:38:57


}
2025-08-15 16:38:57


Error: Missing helper: "gt"
2025-08-15 16:38:57


    at Object.<anonymous> (/app/node_modules/handlebars/dist/cjs/handlebars/helpers/helper-missing.js:19:13)
2025-08-15 16:38:57


    at Object.wrapper (/app/node_modules/handlebars/dist/cjs/handlebars/internal/wrapHelper.js:15:19)
2025-08-15 16:38:57


    at eval (eval at createFunctionContext (/app/node_modules/handlebars/dist/cjs/handlebars/compiler/javascript-compiler.js:262:23), <anonymous>:23:139)
2025-08-15 16:38:57


    at prog (/app/node_modules/handlebars/dist/cjs/handlebars/runtime.js:268:12)
2025-08-15 16:38:57


    at execIteration (/app/node_modules/handlebars/dist/cjs/handlebars/helpers/each.js:51:19)
2025-08-15 16:38:57


    at Object.<anonymous> (/app/node_modules/handlebars/dist/cjs/handlebars/helpers/each.js:61:13)
2025-08-15 16:38:57


    at Object.wrapper (/app/node_modules/handlebars/dist/cjs/handlebars/internal/wrapHelper.js:15:19)
2025-08-15 16:38:57


    at Object.eval [as main] (eval at createFunctionContext (/app/node_modules/handlebars/dist/cjs/handlebars/compiler/javascript-compiler.js:262:23), <anonymous>:19:49)
2025-08-15 16:38:57


    at main (/app/node_modules/handlebars/dist/cjs/handlebars/runtime.js:208:32)
2025-08-15 16:38:57


    at ret (/app/node_modules/handlebars/dist/cjs/handlebars/runtime.js:212:12)
2025-08-15 16:39:07

db   

2025-08-15 15:39:07.903 UTC [27] LOG:  checkpoint starting: time
2025-08-15 16:39:08


2025-08-15 15:39:08.753 UTC [27] LOG:  checkpoint complete: wrote 9 buffers (0.1%); 0 WAL file(s) added, 0 removed, 0 recycled; write=0.830 s, sync=0.006 s, total=0.850 s; sync files=7, longest=0.005 s, average=0.001 s; distance=26 kB, estimate=49 kB
2025-08-15 16:39:13

app  

executed query {
2025-08-15 16:39:13


  text: 'SELECT * FROM users WHERE id = $1 AND is_active = true',
2025-08-15 16:39:13


  duration: 7,
2025-08-15 16:39:13


  rows: 1
2025-08-15 16:39:13


}


