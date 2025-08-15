# This file contains bugs that need addressing in the application

Dashboard Page

1. Fix the dasboard/monthly-overview page. The following error occurs. Server Error Failed to lookup view "dashboard/monthly-overview" in views directory "/app/views"

Properties Page

1. When click on the Add Property button the following page is opened: properties/create and the following error is displayed: Property Error Unable to load property details

Resident Page

1. When clicking on the view or edit buttons for any of the Residents the app opens the relevant page. But, the following error is displayed on each page. Server Error Failed to lookup view "residents/view" in views directory "/app/views"

2. When navigatnig to individual Residents pages the following error is displayed on the page. 

Server Error Missing helper: "gt"

For example on this page: http://localhost:3000/residents/e45f816a-2f71-480f-8fc4-6fd025b45430

3. When navigating to the edit pages for Residents the following error is displayed on the page.

Server Error Missing helper: "formatDateInput"

For example on this page: residents/e45f816a-2f71-480f-8fc4-6fd025b45430/edit

Support Workers Page

1. When clicking on the edit links for any of the Support Workers the app opens the relevant page, but, the following error is displayed on each page. Server Error Missing helper: "contains"
2. When clicking on the view links for any of the Support Workers the app opens the relevant page, but, the following error is displayed on each page. Server Error Missing helper: "gt"

Reports Page

8. Clicking on the Worker Performance link returns the following error when opening the worker-performance page: Worker Performance Error Unable to load worker performance report
9. Clicking on the Dashboard Overview link returns the following error when opening the dashboard/monthly-overview page: Server Error Missing helper: "gt"

