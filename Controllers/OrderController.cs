using Microsoft.AspNetCore.Mvc;

namespace BookShop.Controllers
{
    public class OrderController : Controller
    {
        public IActionResult Index()
        {
            return View();
        }
    }
}
