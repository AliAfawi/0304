using Microsoft.AspNetCore.Mvc;

namespace BookShop.Controllers
{
    public class SearchBookController : Controller
    {
        public IActionResult Index()
        {
            return View();
        }
    }
}
