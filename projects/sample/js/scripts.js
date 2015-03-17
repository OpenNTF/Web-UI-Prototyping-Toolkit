(function ($, document) {
    "use strict";
    $(document).ready(function () {
        $('[data-toggle="offcanvas"]').click(function () {
            $('.row-offcanvas').toggleClass('active');
        });
    });
})(jQuery, document);
