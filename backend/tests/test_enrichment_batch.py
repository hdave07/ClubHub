import unittest

from app.services.enrichment_batch import BatchResult


class BatchResultTests(unittest.TestCase):
    def test_result_counts_are_explicit(self):
        result = BatchResult(selected=5, enriched=4, failed=1, indexed=4)

        self.assertEqual(result.selected, result.enriched + result.failed)
        self.assertEqual(result.indexed, result.enriched)


if __name__ == "__main__":
    unittest.main()
