const searchJobService = require('../services/Search_jobService');

exports.searchJobs = async (req, res) => {
    try {
        // 1. Xử lý và validate tham số phân trang
        const page  = Math.max(1, parseInt(req.query.page)  || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));

        // 2. Gom tất cả filter
        const filters = {
            keyword:   req.query.keyword?.trim()  || null,
            location:  req.query.location?.trim() || null,
            salary:    req.query.salary            || null,
            jobType:   req.query.jobType           || null,
            jobLevel:  req.query.jobLevel          || null,
            page,
            limit
        };

        // 3. Gọi service
        const result = await searchJobService.searchJobs(filters);
        return res.status(200).json({
            status:  'success',
            message: 'Tìm kiếm việc làm thành công',
            data:    result
        });

    } catch (error) {
        console.error('Lỗi API search job:', error);
        return res.status(500).json({
            status:  'error',
            message: 'Lỗi server nội bộ',
            error:   error.message
        });
    }
};